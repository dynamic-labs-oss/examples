"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";
import {
  fetchMaybeSubscriptionAuthority,
  fetchPlansForOwner,
  fetchSubscriptionsForUser,
  findSubscriptionAuthorityPda,
  findSubscriptionDelegationPda,
  getCancelSubscriptionOverlayInstructionAsync,
  getInitSubscriptionAuthorityOverlayInstructionAsync,
  getSubscribeOverlayInstructionAsync,
  PlanStatus,
  type PlanWithAddress,
  type SubscriptionDelegation,
} from "@solana/subscriptions";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { VersionedTransaction } from "@solana/web3.js";
import { signAndSendTransaction } from "@dynamic-labs-sdk/solana";
import { useWallet } from "@/lib/providers";
import { dynamicClient, getSolanaRpcUrl } from "@/lib/dynamic";

const DEFAULT_TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT ?? "";

export type { PlanWithAddress };

export type UserSubscription = {
  address: string;
  data: SubscriptionDelegation;
};

// Build a kit v6 transaction and bridge it to Dynamic for signing
async function sendKitInstructions(
  instructions: Instruction[],
  feePayer: TransactionSigner,
  rpc: ReturnType<typeof createSolanaRpc>,
  walletAccount: ReturnType<typeof useWallet>["solanaAccount"]
): Promise<string> {
  if (!walletAccount) throw new Error("Wallet not connected");

  const { value: { blockhash, lastValidBlockHeight } } =
    await rpc.getLatestBlockhash().send();

  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash, lastValidBlockHeight },
        m
      ),
    (m) => appendTransactionMessageInstructions(instructions, m)
  );

  const compiledTx = compileTransaction(txMessage);
  const wireBase64 = getBase64EncodedWireTransaction(compiledTx);

  // Bridge to @solana/web3.js v1 VersionedTransaction for Dynamic signing
  const txBytes = Buffer.from(wireBase64, "base64");
  const versionedTx = VersionedTransaction.deserialize(txBytes);

  return signAndSendTransaction(
    { transaction: versionedTx, walletAccount },
    dynamicClient
  );
}

export function useSubscriptionOperations() {
  const { solanaAccount } = useWallet();
  const queryClient = useQueryClient();

  const rpcUrl = useMemo(() => {
    try {
      return getSolanaRpcUrl();
    } catch {
      return "https://api.devnet.solana.com";
    }
  }, []);

  const rpc = useMemo(() => createSolanaRpc(rpcUrl), [rpcUrl]);

  const merchantAddress = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS;
  const tokenMintStr =
    process.env.NEXT_PUBLIC_TOKEN_MINT || DEFAULT_TOKEN_MINT;
  const tokenProgramStr =
    process.env.NEXT_PUBLIC_TOKEN_PROGRAM || (TOKEN_PROGRAM_ADDRESS as string);

  // Fetch available plans for the configured merchant
  const {
    data: plans = [],
    isLoading: loadingPlans,
    error: plansError,
  } = useQuery({
    queryKey: ["plans", merchantAddress, rpcUrl],
    queryFn: async () => {
      if (!merchantAddress) return [];
      return fetchPlansForOwner(rpc, address(merchantAddress));
    },
    enabled: !!merchantAddress,
  });

  // Filter to only active plans
  const activePlans = useMemo(
    () => plans.filter((p) => p.data.status === PlanStatus.Active),
    [plans]
  );

  // Fetch user's subscriptions
  const {
    data: userSubscriptions = [],
    isLoading: loadingSubscriptions,
    error: subscriptionsError,
  } = useQuery({
    queryKey: ["subscriptions", solanaAccount?.address, rpcUrl],
    queryFn: async () => {
      if (!solanaAccount) return [];
      const subs = await fetchSubscriptionsForUser(
        rpc,
        address(solanaAccount.address)
      );
      return subs as UserSubscription[];
    },
    enabled: !!solanaAccount,
  });

  // Build a set of plan PDAs the user is already subscribed to
  const subscribedPlanPdas = useMemo(() => {
    const set = new Set<string>();
    for (const sub of userSubscriptions) {
      // delegatee is the plan PDA
      const planPda = sub.data.header.delegatee as string;
      if (planPda) set.add(planPda);
    }
    return set;
  }, [userSubscriptions]);

  // Subscribe to a plan
  const subscribeMutation = useMutation({
    mutationFn: async (plan: PlanWithAddress) => {
      if (!solanaAccount) throw new Error("Wallet not connected");

      const userAddr = address(solanaAccount.address);
      const noopSigner = createNoopSigner(userAddr);
      const tokenMint = address(tokenMintStr);
      const tokenProgram = address(tokenProgramStr);
      const merchant = plan.data.owner as ReturnType<typeof address>;

      const instructions: Instruction[] = [];

      // Check if subscription authority exists for this user+token combination
      const [authorityPda] = await findSubscriptionAuthorityPda({
        tokenMint,
        user: userAddr,
      });

      const maybeAuthority = await fetchMaybeSubscriptionAuthority(
        rpc,
        authorityPda
      );

      if (!maybeAuthority.exists) {
        // Derive user's associated token account
        const [userAta] = await findAssociatedTokenPda({
          mint: tokenMint,
          owner: userAddr,
          tokenProgram,
        });

        const initIx = await getInitSubscriptionAuthorityOverlayInstructionAsync({
          owner: noopSigner,
          tokenMint,
          tokenProgram,
          userAta,
        });
        instructions.push(initIx);
      }

      // Build subscribe instruction using plan terms
      const subscribeIx = await getSubscribeOverlayInstructionAsync({
        subscriber: noopSigner,
        merchant,
        planId: plan.data.data.planId,
        tokenMint,
        expectedAmount: plan.data.data.terms.amount,
        expectedPeriodHours: plan.data.data.terms.periodHours,
        expectedCreatedAt: plan.data.data.terms.createdAt,
      });
      instructions.push(subscribeIx);

      return sendKitInstructions(instructions, noopSigner, rpc, solanaAccount);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["subscriptions", solanaAccount?.address],
      });
    },
  });

  // Cancel a subscription
  const cancelMutation = useMutation({
    mutationFn: async ({
      planPda,
      subscriptionPda,
    }: {
      planPda: string;
      subscriptionPda: string;
    }) => {
      if (!solanaAccount) throw new Error("Wallet not connected");

      const noopSigner = createNoopSigner(address(solanaAccount.address));

      const cancelIx = await getCancelSubscriptionOverlayInstructionAsync({
        subscriber: noopSigner,
        planPda: address(planPda),
        subscriptionPda: address(subscriptionPda),
      });

      return sendKitInstructions([cancelIx], noopSigner, rpc, solanaAccount);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["subscriptions", solanaAccount?.address],
      });
    },
  });

  // Get the subscription PDA for a plan (if the user is subscribed)
  const getSubscriptionPdaForPlan = useCallback(
    async (planPda: string): Promise<string | null> => {
      if (!solanaAccount) return null;
      const [subPda] = await findSubscriptionDelegationPda({
        planPda: address(planPda),
        subscriber: address(solanaAccount.address),
      });
      return subscribedPlanPdas.has(planPda) ? (subPda as string) : null;
    },
    [solanaAccount, subscribedPlanPdas]
  );

  return {
    activePlans,
    userSubscriptions,
    subscribedPlanPdas,
    loadingPlans,
    loadingSubscriptions,
    plansError,
    subscriptionsError,
    subscribeMutation,
    cancelMutation,
    merchantAddress,
    tokenMintStr,
    getSubscriptionPdaForPlan,
  };
}
