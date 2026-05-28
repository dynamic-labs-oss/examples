"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { address, createNoopSigner, type Instruction } from "@solana/kit";
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
import { isSolanaWalletAccount } from "@dynamic-labs-sdk/solana";
import { useWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
import { useWallet } from "@/lib/useWallet";
import { getKitRpc } from "@/lib/dynamic";
import { sendKitInstructions } from "./tx";

export const PlanStatus = { Active: 1, Sunset: 0 } as const;

export type UserSubscription = { address: string; data: SubscriptionDelegation };
export type EnrichedSubscription = { sub: UserSubscription; planData: PlanWithAddress | null };

export function useSubscriptionOperations() {
  const { solanaAccount } = useWallet();
  const queryClient = useQueryClient();
  const tokenMintStr = process.env.NEXT_PUBLIC_TOKEN_MINT ?? "";

  const invalidateSubscriptions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["subscriptions", solanaAccount?.address] });
    queryClient.invalidateQueries({ queryKey: ["enrichedSubscriptions"] });
  }, [queryClient, solanaAccount?.address]);

  const { data: plans = [], isLoading: loadingPlans, error: plansError } = useQuery({
    queryKey: ["plans", process.env.NEXT_PUBLIC_MERCHANT_ADDRESS, solanaAccount?.address],
    queryFn: async () => {
      const rpc = await getKitRpc(solanaAccount!);
      return fetchPlansForOwner(rpc, address(process.env.NEXT_PUBLIC_MERCHANT_ADDRESS!));
    },
    enabled: !!process.env.NEXT_PUBLIC_MERCHANT_ADDRESS && !!solanaAccount,
  });

  const activePlans = useMemo(() => plans.filter((p) => p.data.status === PlanStatus.Active), [plans]);

  const { data: userSubscriptions = [], isLoading: loadingSubscriptions, error: subscriptionsError } = useQuery({
    queryKey: ["subscriptions", solanaAccount?.address],
    queryFn: async () => {
      const rpc = await getKitRpc(solanaAccount!);
      return fetchSubscriptionsForUser(rpc, address(solanaAccount!.address)) as Promise<UserSubscription[]>;
    },
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
      const rpc = await getKitRpc(solanaAccount);
      const [ata] = await findAssociatedTokenPda({ mint: address(tokenMint), owner: address(solanaAccount.address), tokenProgram: TOKEN_PROGRAM_ADDRESS });
      return BigInt((await rpc.getTokenAccountBalance(ata).send()).value.amount);
    } catch { return 0n; }
  }, [solanaAccount]);

  const subscribeMutation = useMutation({
    mutationFn: async (plan: PlanWithAddress) => {
      if (!solanaAccount) throw new Error("Wallet not connected");
      const rpc = await getKitRpc(solanaAccount);
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
      return sendKitInstructions(instructions, noopSigner, solanaAccount);
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
        noopSigner, solanaAccount
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
        noopSigner, solanaAccount
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
    queryKey: ["enrichedSubscriptions", userSubscriptions.map((s) => s.address)],
    queryFn: async () => {
      const rpc = await getKitRpc(solanaAccount!);
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
    enabled: userSubscriptions.length > 0 && !!solanaAccount,
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
  const walletAccounts = useWalletAccounts();
  const solanaAccount = walletAccounts.find(isSolanaWalletAccount) ?? null;

  const fetchMerchantPlans = useCallback(async (addr: string) => {
    if (!solanaAccount) return [];
    const rpc = await getKitRpc(solanaAccount);
    return fetchPlansForOwner(rpc, address(addr));
  }, [solanaAccount]);

  return { fetchMerchantPlans, networkKey: solanaAccount?.address ?? "" };
}
