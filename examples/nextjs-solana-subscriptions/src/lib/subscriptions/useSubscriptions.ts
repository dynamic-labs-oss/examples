"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { address, createNoopSigner, createSolanaRpc, type Instruction } from "@solana/kit";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  fetchMaybeSubscriptionAuthority,
  fetchPlan,
  fetchPlansForOwner,
  fetchSubscriptionsForUser,
  findSubscriptionAuthorityPda,
  findSubscriptionDelegationPda,
  getCancelSubscriptionOverlayInstructionAsync,
  getInitSubscriptionAuthorityOverlayInstructionAsync,
  getResumeSubscriptionOverlayInstructionAsync,
  getSubscribeOverlayInstructionAsync,
  type PlanWithAddress,
  type SubscriptionDelegation,
} from "@solana/subscriptions";
import { useWallet } from "@/lib/providers";
import { getSolanaRpcUrl } from "@/lib/dynamic";
import { sendKitInstructions } from "./tx";

export const PlanStatus = { Active: 1, Sunset: 0 } as const;

export type UserSubscription = { address: string; data: SubscriptionDelegation };
export type EnrichedSubscription = { sub: UserSubscription; planData: PlanWithAddress | null };

export function useSubscriptionOperations() {
  const { solanaAccount } = useWallet();
  const queryClient = useQueryClient();
  const rpcUrl = useMemo(() => getSolanaRpcUrl(), []);
  const rpc = useMemo(() => createSolanaRpc(rpcUrl), [rpcUrl]);
  const tokenMintStr = process.env.NEXT_PUBLIC_TOKEN_MINT ?? "";

  const invalidateSubscriptions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["subscriptions", solanaAccount?.address] });
    queryClient.invalidateQueries({ queryKey: ["enrichedSubscriptions"] });
  }, [queryClient, solanaAccount?.address]);

  const { data: plans = [], isLoading: loadingPlans, error: plansError } = useQuery({
    queryKey: ["plans", process.env.NEXT_PUBLIC_MERCHANT_ADDRESS, rpcUrl],
    queryFn: () => fetchPlansForOwner(rpc, address(process.env.NEXT_PUBLIC_MERCHANT_ADDRESS!)),
    enabled: !!process.env.NEXT_PUBLIC_MERCHANT_ADDRESS,
  });

  const activePlans = useMemo(() => plans.filter((p) => p.data.status === PlanStatus.Active), [plans]);

  const { data: userSubscriptions = [], isLoading: loadingSubscriptions, error: subscriptionsError } = useQuery({
    queryKey: ["subscriptions", solanaAccount?.address, rpcUrl],
    queryFn: () => fetchSubscriptionsForUser(rpc, address(solanaAccount!.address)) as Promise<UserSubscription[]>,
    enabled: !!solanaAccount,
  });

  const subscribedPlanPdas = useMemo(() => {
    const set = new Set<string>();
    for (const sub of userSubscriptions)
      if (sub.data.expiresAtTs === 0n)
        set.add(sub.data.header.delegatee as string);
    return set;
  }, [userSubscriptions]);

  const cancellingPlanPdas = useMemo(() => {
    const set = new Set<string>();
    for (const sub of userSubscriptions)
      if (sub.data.expiresAtTs > 0n)
        set.add(sub.data.header.delegatee as string);
    return set;
  }, [userSubscriptions]);

  const getTokenBalance = useCallback(async (tokenMint: string): Promise<bigint> => {
    if (!solanaAccount) return 0n;
    try {
      const [ata] = await findAssociatedTokenPda({ mint: address(tokenMint), owner: address(solanaAccount.address), tokenProgram: TOKEN_PROGRAM_ADDRESS });
      return BigInt((await rpc.getTokenAccountBalance(ata).send()).value.amount);
    } catch { return 0n; }
  }, [solanaAccount, rpc]);

  const subscribeMutation = useMutation({
    mutationFn: async (plan: PlanWithAddress) => {
      if (!solanaAccount) throw new Error("Wallet not connected");
      const userAddr = address(solanaAccount.address);
      const noopSigner = createNoopSigner(userAddr);
      const tokenMint = address(tokenMintStr);
      const instructions: Instruction[] = [];

      const [authorityPda] = await findSubscriptionAuthorityPda({ tokenMint, user: userAddr });
      const maybeAuth = await fetchMaybeSubscriptionAuthority(rpc, authorityPda);
      if (!maybeAuth.exists) {
        const [userAta] = await findAssociatedTokenPda({ mint: tokenMint, owner: userAddr, tokenProgram: TOKEN_PROGRAM_ADDRESS });
        instructions.push(await getInitSubscriptionAuthorityOverlayInstructionAsync({ owner: noopSigner, tokenMint, tokenProgram: TOKEN_PROGRAM_ADDRESS, userAta }));
      }
      instructions.push(await getSubscribeOverlayInstructionAsync({
        subscriber: noopSigner,
        merchant: plan.data.owner,
        planId: plan.data.data.planId,
        tokenMint,
        expectedAmount: plan.data.data.terms.amount,
        expectedCreatedAt: plan.data.data.terms.createdAt,
        expectedPeriodHours: plan.data.data.terms.periodHours,
      }));
      return sendKitInstructions(instructions, noopSigner, rpc, solanaAccount);
    },
    onSuccess: invalidateSubscriptions,
    onError: (err) => {
      // 0x205 = alreadySubscribed — treat as success and refresh state
      if (String(err).includes("0x205")) invalidateSubscriptions();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ planPda, subscriptionPda }: { planPda: string; subscriptionPda: string }) => {
      if (!solanaAccount) throw new Error("Wallet not connected");
      const noopSigner = createNoopSigner(address(solanaAccount.address));
      return sendKitInstructions(
        [await getCancelSubscriptionOverlayInstructionAsync({ subscriber: noopSigner, planPda: address(planPda), subscriptionPda: address(subscriptionPda) })],
        noopSigner, rpc, solanaAccount
      );
    },
    onSuccess: invalidateSubscriptions,
  });

  const resumeMutation = useMutation({
    mutationFn: async ({ planPda, subscriptionPda }: { planPda: string; subscriptionPda: string }) => {
      if (!solanaAccount) throw new Error("Wallet not connected");
      const noopSigner = createNoopSigner(address(solanaAccount.address));
      return sendKitInstructions(
        [await getResumeSubscriptionOverlayInstructionAsync({ subscriber: noopSigner, planPda: address(planPda), subscriptionPda: address(subscriptionPda) })],
        noopSigner, rpc, solanaAccount
      );
    },
    onSuccess: invalidateSubscriptions,
  });

  const getSubscriptionPdaForPlan = useCallback(async (planPda: string): Promise<string | null> => {
    if (!solanaAccount) return null;
    const [subPda] = await findSubscriptionDelegationPda({ planPda: address(planPda), subscriber: address(solanaAccount.address) });
    return subscribedPlanPdas.has(planPda) ? (subPda as string) : null;
  }, [solanaAccount, subscribedPlanPdas]);

  const { data: enrichedSubscriptions = [] } = useQuery({
    queryKey: ["enrichedSubscriptions", userSubscriptions.map((s) => s.address), rpcUrl],
    queryFn: async () => {
      const results = await Promise.allSettled(
        userSubscriptions.map(async (sub) => {
          let planData: PlanWithAddress | null = null;
          try { planData = await fetchPlan(rpc, sub.data.header.delegatee); } catch { /* not found */ }
          return { sub, planData };
        })
      );
      return results
        .map((r) => r.status === "fulfilled" ? r.value : { sub: null, planData: null })
        .filter((r): r is EnrichedSubscription => r.sub !== null);
    },
    enabled: userSubscriptions.length > 0,
  });

  return {
    activePlans, userSubscriptions, enrichedSubscriptions, subscribedPlanPdas, cancellingPlanPdas,
    loadingPlans, loadingSubscriptions, plansError, subscriptionsError,
    subscribeMutation, cancelMutation, resumeMutation,
    merchantAddress: process.env.NEXT_PUBLIC_MERCHANT_ADDRESS,
    tokenMintStr, tokenDecimals: 6,
    getSubscriptionPdaForPlan, getTokenBalance,
  };
}

export function useMerchantSearchOperations() {
  const rpcUrl = useMemo(() => getSolanaRpcUrl(), []);
  const rpc = useMemo(() => createSolanaRpc(rpcUrl), [rpcUrl]);
  const fetchMerchantPlans = useCallback(
    (addr: string) => fetchPlansForOwner(rpc, address(addr)),
    [rpc]
  );
  return { fetchMerchantPlans, rpc, rpcUrl };
}
