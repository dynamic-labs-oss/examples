"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { dynamicClient } from "./dynamic";
import { useWallet } from "./useWallet";
import { signPlanAuthorizations, type SignedAuthorization } from "./eip3009";
import { PLAN } from "./config";
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

export type Subscription = {
  id: string;
  subscriber: string;
  merchant: string;
  chain_id: number;
  token_address: string;
  amount: string;
  period_seconds: number;
  pulls_total: number;
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

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!evmAccount) throw new Error("Connect a wallet first");
      const walletClient = await createWalletClientForWalletAccount(
        { walletAccount: evmAccount },
        dynamicClient,
      );
      const auths = await signPlanAuthorizations({ walletClient });
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscriber: evmAccount.address, auths }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to save subscription");
      return body;
    },
    onSuccess: () => {
      toast.success(`Subscribed — ${PLAN.pulls} pull authorizations signed.`);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Subscribe failed"),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/subscriptions/${id}?subscriber=${address}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Cancel failed");
    },
    onSuccess: () => {
      toast.success("Subscription cancelled — pending pulls voided.");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Cancel failed"),
  });

  const collectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cron/collect", { method: "POST" });
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
