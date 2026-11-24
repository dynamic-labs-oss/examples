"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getActiveNetworkData, switchActiveNetwork } from "@dynamic-labs-sdk/client";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { dynamicClient } from "./dynamic";
import { useWallet } from "./useWallet";
import { CHAIN_ID, CHAIN_NAME, PLAN, type SubscriptionMode } from "./config";
import { signPlanAuthorizations, signRelayAuthorizations } from "./eip3009";
import { ensurePermit2Approval, revokePlanAllowance, signPlanPermit } from "./permit2";
import { toast } from "./toast";

export type AuthorizationSummary = {
  id: string;
  period_index: number;
  valid_after: number;
  valid_before: number;
  status: "pending" | "posting" | "posted" | "failed" | "cancelled";
  tx_hash: string | null;
  error: string | null;
  posted_at: string | null;
};

// Two ways to authorize pulls:
//  permit2 (default): ONE signature. Either a fixed number of pulls (`pulls`),
//    or "until cancelled" = an unlimited, non-expiring permit (pulls_total null).
//  eip3009: one signature PER pull (`pulls`), executed by our relayer
//    ("direct") or by Relay ("relay"). Always a fixed count.
export type SubscribeVars = {
  mode?: SubscriptionMode;
  openEnded?: boolean;
  pulls?: number;
  executor?: "direct" | "relay";
};

export type Subscription = {
  id: string;
  subscriber: string;
  merchant: string;
  chain_id: number;
  token_address: string;
  amount: string;
  period_seconds: number;
  pulls_total: number | null; // null = open-ended ("until cancelled")
  mode: SubscriptionMode;
  plan_contract: string | null;
  status: "active" | "cancelled" | "completed";
  created_at: string;
  authorizations: AuthorizationSummary[];
};

export function useSubscriptions() {
  const { evmAccount } = useWallet();
  const queryClient = useQueryClient();
  const address = evmAccount?.address;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["evm-subscriptions", address] });

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["evm-subscriptions", address],
    queryFn: async (): Promise<Subscription[]> => {
      const res = await fetch(`/api/subscriptions?subscriber=${address}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to load subscriptions");
      return body;
    },
    enabled: !!address,
    refetchInterval: 30_000,
  });

  // Moves the wallet onto the plan's chain, then returns a viem wallet client.
  const getWalletClient = async () => {
    if (!evmAccount) throw new Error("Connect a wallet first");
    // Dynamic resolves the wallet's active network against the networks
    // enabled for the environment; if the wallet sits on any other chain
    // there's no network data and wallet-client creation throws. Move it to
    // the plan's chain first.
    const active = await getActiveNetworkData({ walletAccount: evmAccount }, dynamicClient).catch(
      () => null,
    );
    if (String(active?.networkData?.networkId) !== String(CHAIN_ID)) {
      try {
        await switchActiveNetwork(
          { walletAccount: evmAccount, networkId: String(CHAIN_ID) },
          dynamicClient,
        );
      } catch {
        throw new Error(`Switch your wallet to ${CHAIN_NAME} (chain ${CHAIN_ID}) and try again.`);
      }
    }
    return createWalletClientForWalletAccount({ walletAccount: evmAccount }, dynamicClient);
  };

  const subscribeMutation = useMutation({
    mutationFn: async ({
      mode = "permit2",
      openEnded = false,
      pulls = PLAN.pulls,
      executor = "direct",
    }: SubscribeVars = {}) => {
      if (!evmAccount) throw new Error("Connect a wallet first");
      const walletClient = await getWalletClient();
      const owner = evmAccount.address as `0x${string}`;

      if (mode === "eip3009") {
        // N signatures, no on-chain transaction and no gas for the subscriber.
        const auths =
          executor === "relay"
            ? await signRelayAuthorizations({ walletClient, pulls })
            : await signPlanAuthorizations({ walletClient, pulls });
        const res = await fetch("/api/subscriptions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "eip3009", subscriber: owner, auths }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Failed to save subscription");
        return body;
      }

      // One-time (per wallet + token) approval for Permit2, then ONE signature.
      const approvalTx = await ensurePermit2Approval({
        walletClient,
        owner,
        // Open-ended needs a standing (max) USDC allowance for Permit2.
        minAmount: openEnded ? 2n ** 255n : PLAN.amount * BigInt(pulls),
      });
      if (approvalTx) toast.success("USDC approved for Permit2 (one-time). Now sign the subscription.");
      const { permit, signature } = await signPlanPermit({ walletClient, owner, openEnded, pulls });

      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriber: owner,
          permit: {
            details: {
              token: permit.details.token,
              amount: permit.details.amount.toString(),
              expiration: permit.details.expiration,
              nonce: permit.details.nonce,
            },
            spender: permit.spender,
            sigDeadline: permit.sigDeadline.toString(),
          },
          signature,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to save subscription");
      return body;
    },
    onSuccess: (_data, vars) => {
      const n = vars?.pulls ?? PLAN.pulls;
      toast.success(
        vars?.mode === "eip3009"
          ? `Subscribed — ${n} pull authorizations signed.`
          : vars?.openEnded
            ? "Subscribed — pulls continue every period until you cancel."
            : `Subscribed — one signature covers ${n} pulls.`,
      );
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Subscribe failed"),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const sub = subscriptions.find((s) => s.id === id);
      if (!sub || !evmAccount) throw new Error("Subscription not found");
      // Permit2: cancelling is an on-chain revoke from the subscriber's own
      // wallet (zero the allowance), then we tell the server. EIP-3009 has no
      // allowance; the server just discards the stored signatures.
      if (sub.mode !== "eip3009") {
        if (!sub.plan_contract) throw new Error("Subscription has no plan contract");
        const walletClient = await getWalletClient();
        await revokePlanAllowance({
          walletClient,
          owner: evmAccount.address as `0x${string}`,
          plan: sub.plan_contract as `0x${string}`,
        });
      }
      const res = await fetch(`/api/subscriptions/${id}?subscriber=${address}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Cancel failed");
    },
    onSuccess: () => {
      toast.success("Subscription cancelled.");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Cancel failed"),
  });

  const collectMutation = useMutation({
    mutationFn: async () => {
      // Scoped to this wallet and needs no secret (the schedule route does).
      if (!address) throw new Error("Connect a wallet first");
      const res = await fetch(`/api/collect?subscriber=${address}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Collect failed");
      return body as { collected: number; results: { ok: boolean }[] };
    },
    onSuccess: (data) => {
      const ok = data.results.filter((r) => r.ok).length;
      toast.success(`Collected ${ok}/${data.collected} due pulls.`);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Collect failed"),
  });

  return { subscriptions, isLoading, subscribeMutation, cancelMutation, collectMutation };
}
