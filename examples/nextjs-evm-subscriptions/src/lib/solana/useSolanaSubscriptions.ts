"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { address, createNoopSigner, type Instruction } from "@solana/kit";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  fetchMaybeSubscriptionAuthority,
  fetchPlan,
  fetchPlansForOwner,
  fetchSubscriptionsForUser,
  findSubscriptionAuthorityPda,
  getCancelSubscriptionOverlayInstructionAsync,
  getInitSubscriptionAuthorityOverlayInstructionAsync,
  getResumeSubscriptionOverlayInstructionAsync,
  PlanStatus,
  type PlanWithAddress,
  type SubscriptionDelegation,
} from "@solana/subscriptions";
import { useWallet } from "../useWallet";
import { toast } from "../toast";
import { SOLANA_MERCHANT_ADDRESS, SOLANA_TOKEN_MINT } from "./config";
import { subscriptionsClient } from "./client";
import { solanaRpc } from "./rpc";
import { sendKitInstructions } from "./tx";

export type SolanaPlan = PlanWithAddress;
export type SolanaSubscription = {
  address: string;
  data: SubscriptionDelegation;
  plan: PlanWithAddress | null;
};

const MINT = address(SOLANA_TOKEN_MINT);

export function useSolanaSubscriptions() {
  const { solanaAccount } = useWallet();
  const queryClient = useQueryClient();
  const owner = solanaAccount?.address;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["solana-subscriptions", owner] });
    // Give devnet a moment, then refetch again in case the RPC was behind.
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ["solana-subscriptions", owner] }), 2500);
  };

  const { data: plans = [], isLoading: loadingPlans, error: plansError } = useQuery({
    queryKey: ["solana-plans", SOLANA_MERCHANT_ADDRESS],
    queryFn: async () => {
      const all = await fetchPlansForOwner(solanaRpc(), address(SOLANA_MERCHANT_ADDRESS!));
      return all.filter((p) => p.data.status === PlanStatus.Active && p.data.data.mint === MINT);
    },
    enabled: !!SOLANA_MERCHANT_ADDRESS,
    staleTime: 30_000,
  });

  const { data: subscriptions = [], isLoading: loadingSubscriptions } = useQuery({
    queryKey: ["solana-subscriptions", owner],
    queryFn: async (): Promise<SolanaSubscription[]> => {
      const rpc = solanaRpc();
      const subs = await fetchSubscriptionsForUser(rpc, address(owner!));
      return Promise.all(
        subs.map(async (s) => ({
          address: s.address as string,
          data: s.data,
          plan: await fetchPlan(rpc, s.data.header.delegatee).catch(() => null),
        })),
      );
    },
    enabled: !!owner,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  // Plans the wallet is already subscribed to (not cancelling).
  const activePlanAddresses = useMemo(
    () =>
      new Set(
        subscriptions.filter((s) => s.data.expiresAtTs === 0n).map((s) => s.data.header.delegatee as string),
      ),
    [subscriptions],
  );

  const subscribeMutation = useMutation({
    mutationFn: async (plan: PlanWithAddress) => {
      if (!solanaAccount) throw new Error("Connect a Solana wallet first");
      const rpc = solanaRpc();
      const user = address(solanaAccount.address);
      const signer = createNoopSigner(user);
      const client = subscriptionsClient(solanaAccount.address);

      // One-time per wallet + mint: the authority PDA that lets plans pull.
      // `subscribe` commits to the authority's init id, which only exists once
      // this has landed, so a first-time subscriber signs two transactions.
      const [authorityPda] = await findSubscriptionAuthorityPda({ tokenMint: MINT, user });
      const existing = await fetchMaybeSubscriptionAuthority(rpc, authorityPda);
      if (!existing.exists) {
        const [userAta] = await findAssociatedTokenPda({
          mint: MINT,
          owner: user,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
        });
        await sendKitInstructions(
          [
            await getInitSubscriptionAuthorityOverlayInstructionAsync({
              owner: signer,
              tokenMint: MINT,
              tokenProgram: TOKEN_PROGRAM_ADDRESS,
              userAta,
            }),
          ],
          signer,
          solanaAccount,
        );
        toast.success("Subscription authority created. Now confirm the subscription.");
      }

      // The plugin client fetches the live plan terms and the authority's
      // init id itself. Right after the init above the RPC can briefly not
      // see the new account yet, so retry that one case.
      let subscribeIx: Instruction | undefined;
      for (let attempt = 0; attempt < 8 && !subscribeIx; attempt++) {
        try {
          subscribeIx = await client.subscriptions.instructions.subscribe({
            merchant: plan.data.owner,
            planId: plan.data.data.planId,
            tokenMint: MINT,
          });
        } catch (err) {
          const notYet = err instanceof Error && /not initialized/i.test(err.message);
          if (!notYet || attempt === 7) throw err;
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      return sendKitInstructions([subscribeIx!], signer, solanaAccount);
    },
    onSuccess: () => {
      toast.success("Subscribed on Solana — the merchant can now pull each period.");
      invalidate();
    },
    onError: (err) => {
      // 0x205 = already subscribed: treat as success and refresh.
      if (String(err).includes("0x205")) {
        toast.success("You're already subscribed to this plan.");
        invalidate();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Subscribe failed");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (sub: SolanaSubscription) => {
      if (!solanaAccount) throw new Error("Connect a Solana wallet first");
      const signer = createNoopSigner(address(solanaAccount.address));
      return sendKitInstructions(
        [
          await getCancelSubscriptionOverlayInstructionAsync({
            subscriber: signer,
            planPda: sub.data.header.delegatee,
            subscriptionPda: address(sub.address),
          }),
        ],
        signer,
        solanaAccount,
      );
    },
    onSuccess: () => {
      toast.success("Cancelled — no pulls after the current period ends.");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Cancel failed"),
  });

  const resumeMutation = useMutation({
    mutationFn: async (sub: SolanaSubscription) => {
      if (!solanaAccount) throw new Error("Connect a Solana wallet first");
      const signer = createNoopSigner(address(solanaAccount.address));
      return sendKitInstructions(
        [
          await getResumeSubscriptionOverlayInstructionAsync({
            subscriber: signer,
            planPda: sub.data.header.delegatee,
            subscriptionPda: address(sub.address),
            tokenMint: MINT,
            expectedExpiresAtTs: sub.data.expiresAtTs,
          }),
        ],
        signer,
        solanaAccount,
      );
    },
    onSuccess: () => {
      toast.success("Subscription resumed.");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Resume failed"),
  });

  // Server-side collection for this wallet only (secret-free, already-due only).
  const collectMutation = useMutation({
    mutationFn: async () => {
      if (!owner) throw new Error("Connect a Solana wallet first");
      const res = await fetch(`/api/solana/collect?subscriber=${owner}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Collect failed");
      return body as { collected: number; results: { ok: boolean }[] };
    },
    onSuccess: (data) => {
      const ok = data.results.filter((r) => r.ok).length;
      toast.success(`Collected ${ok}/${data.collected} due Solana pulls.`);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Collect failed"),
  });

  return {
    solanaAccount,
    plans,
    loadingPlans,
    plansError,
    subscriptions,
    loadingSubscriptions,
    activePlanAddresses,
    subscribeMutation,
    cancelMutation,
    resumeMutation,
    collectMutation,
  };
}
