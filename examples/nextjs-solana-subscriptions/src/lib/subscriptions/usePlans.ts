"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { address, createNoopSigner, createSolanaRpc, type Instruction } from "@solana/kit";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  fetchDelegationsByDelegatee,
  fetchPlansForOwner,
  getCreatePlanOverlayInstructionAsync,
  getDeletePlanOverlayInstruction,
  getTransferSubscriptionOverlayInstructionAsync,
  type Delegation,
} from "@solana/subscriptions";
import { useWallet } from "@/lib/providers";
import { getSolanaRpcUrl } from "@/lib/dynamic";
import { sendKitInstructions } from "./tx";

export function useMyPlansOperations() {
  const { solanaAccount } = useWallet();
  const queryClient = useQueryClient();
  const rpcUrl = useMemo(() => getSolanaRpcUrl(), []);
  const rpc = useMemo(() => createSolanaRpc(rpcUrl), [rpcUrl]);
  const tokenMintStr = process.env.NEXT_PUBLIC_TOKEN_MINT ?? "";

  const { data: myPlans = [], isLoading: loadingMyPlans, error: myPlansError } = useQuery({
    queryKey: ["plans", "my", solanaAccount?.address, rpcUrl],
    queryFn: () => solanaAccount ? fetchPlansForOwner(rpc, address(solanaAccount.address)) : [],
    enabled: !!solanaAccount,
  });

  const createPlanMutation = useMutation({
    mutationFn: async (params: {
      planId: bigint; mint: string; amount: bigint; periodHours: number;
      endTs: number; destinations: string[]; pullers: string[]; metadataUri: string;
    }) => {
      if (!solanaAccount) throw new Error("Wallet not connected");
      const noopSigner = createNoopSigner(address(solanaAccount.address));
      return sendKitInstructions(
        [await getCreatePlanOverlayInstructionAsync({
          owner: noopSigner,
          planId: params.planId,
          mint: address(params.mint),
          amount: params.amount,
          periodHours: BigInt(params.periodHours),
          endTs: BigInt(params.endTs),
          destinations: params.destinations.filter(Boolean).map((d) => address(d)),
          pullers: params.pullers.filter(Boolean).map((p) => address(p)),
          metadataUri: params.metadataUri,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
        })],
        noopSigner, rpc, solanaAccount
      );
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["plans", "my"] }); },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planAddress: string) => {
      if (!solanaAccount) throw new Error("Wallet not connected");
      const noopSigner = createNoopSigner(address(solanaAccount.address));
      return sendKitInstructions(
        [getDeletePlanOverlayInstruction({ owner: noopSigner, planPda: address(planAddress) })],
        noopSigner, rpc, solanaAccount
      );
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["plans", "my"] }); },
  });

  return { myPlans, loadingMyPlans, myPlansError, tokenMintStr, createPlanMutation, deletePlanMutation, rpc, rpcUrl };
}

export function useCollectPaymentsOperations() {
  const { solanaAccount } = useWallet();
  const queryClient = useQueryClient();
  const rpcUrl = useMemo(() => getSolanaRpcUrl(), []);
  const rpc = useMemo(() => createSolanaRpc(rpcUrl), [rpcUrl]);
  const tokenMintStr = process.env.NEXT_PUBLIC_TOKEN_MINT ?? "";

  const { data: myPlans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ["plans", "my", solanaAccount?.address, rpcUrl],
    queryFn: () => solanaAccount ? fetchPlansForOwner(rpc, address(solanaAccount.address)) : [],
    enabled: !!solanaAccount,
  });

  const collectPaymentMutation = useMutation({
    mutationFn: async ({ planAddress, subscriptionAddress, delegatorAddress, amount }: { planAddress: string; subscriptionAddress: string; delegatorAddress: string; amount: bigint }) => {
      if (!solanaAccount) throw new Error("Wallet not connected");
      const userAddr = address(solanaAccount.address);
      const noopSigner = createNoopSigner(userAddr);
      const mintAddr = address(tokenMintStr);
      const [receiverAta] = await findAssociatedTokenPda({ mint: mintAddr, owner: userAddr, tokenProgram: TOKEN_PROGRAM_ADDRESS });
      return sendKitInstructions(
        [
          getCreateAssociatedTokenIdempotentInstruction({ payer: noopSigner, ata: receiverAta, owner: userAddr, mint: mintAddr, tokenProgram: TOKEN_PROGRAM_ADDRESS }) as unknown as Instruction,
          await getTransferSubscriptionOverlayInstructionAsync({ caller: noopSigner, subscriptionPda: address(subscriptionAddress), planPda: address(planAddress), delegator: address(delegatorAddress), receiverAta, tokenMint: mintAddr, tokenProgram: TOKEN_PROGRAM_ADDRESS, amount }),
        ],
        noopSigner, rpc, solanaAccount
      );
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["plans", "my"] }); },
  });

  const fetchPlanSubscribers = useCallback(async (planAddress: string) => {
    const delegations = await fetchDelegationsByDelegatee(rpc, address(planAddress));
    return delegations
      .filter((d): d is Extract<Delegation, { kind: "subscription" }> => d.kind === "subscription")
      .map((d) => ({ address: d.address as string, data: d.data }));
  }, [rpc]);

  return { myPlans, loadingPlans, collectPaymentMutation, fetchPlanSubscribers, tokenMintStr, rpc };
}
