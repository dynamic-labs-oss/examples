"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { address, createNoopSigner, type Address, type Instruction } from "@solana/kit";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  fetchDelegationsByDelegatee,
  fetchDelegationsByDelegator,
  fetchMaybeSubscriptionAuthority,
  findSubscriptionAuthorityPda,
  getCreateFixedDelegationOverlayInstructionAsync,
  getCreateRecurringDelegationOverlayInstructionAsync,
  getInitSubscriptionAuthorityOverlayInstructionAsync,
  getRevokeDelegationOverlayInstruction,
  getTransferFixedOverlayInstructionAsync,
  getTransferRecurringOverlayInstructionAsync,
  type Delegation,
} from "@solana/subscriptions";
import { useWallet } from "@/lib/useWallet";
import { getKitRpc } from "@/lib/dynamic";
import { sendKitInstructions } from "./tx";

export type DelegationWithAddress = Exclude<Delegation, { kind: "subscription" }>;

export function useDelegationOperations() {
  const { solanaAccount } = useWallet();
  const queryClient = useQueryClient();
  const tokenMintStr = process.env.NEXT_PUBLIC_TOKEN_MINT ?? "";

  const { data: outgoingDelegations = [], isLoading: loadingOutgoing } = useQuery({
    queryKey: ["delegations", "outgoing", solanaAccount?.address],
    queryFn: async () => {
      const rpc = await getKitRpc(solanaAccount!);
      const all = await fetchDelegationsByDelegator(rpc, address(solanaAccount!.address));
      return all.filter((d): d is DelegationWithAddress => d.kind !== "subscription");
    },
    enabled: !!solanaAccount,
  });

  const { data: incomingDelegations = [], isLoading: loadingIncoming } = useQuery({
    queryKey: ["delegations", "incoming", solanaAccount?.address],
    queryFn: async () => {
      const rpc = await getKitRpc(solanaAccount!);
      const all = await fetchDelegationsByDelegatee(rpc, address(solanaAccount!.address));
      return all.filter((d): d is DelegationWithAddress => d.kind !== "subscription");
    },
    enabled: !!solanaAccount,
  });

  async function ensureAuthority(rpc: Awaited<ReturnType<typeof getKitRpc>>, userAddr: Address, noopSigner: ReturnType<typeof createNoopSigner>): Promise<Instruction[]> {
    const tokenMint = address(tokenMintStr);
    const [authorityPda] = await findSubscriptionAuthorityPda({ tokenMint, user: userAddr });
    const maybeAuth = await fetchMaybeSubscriptionAuthority(rpc, authorityPda);
    if (!maybeAuth.exists) {
      const [userAta] = await findAssociatedTokenPda({ mint: tokenMint, owner: userAddr, tokenProgram: TOKEN_PROGRAM_ADDRESS });
      return [await getInitSubscriptionAuthorityOverlayInstructionAsync({ owner: noopSigner, tokenMint, tokenProgram: TOKEN_PROGRAM_ADDRESS, userAta })];
    }
    return [];
  }

  async function claimTransfer(
    receiverAddress: string,
    delegation: { data: { mint: Address; header: { delegator: Address } }; address: Address },
    getTransferIx: (signer: ReturnType<typeof createNoopSigner>, delegatorAta: Address, receiverAta: Address) => Promise<Instruction>
  ) {
    if (!solanaAccount) throw new Error("Wallet not connected");
    const noopSigner = createNoopSigner(address(solanaAccount.address));
    const { mint: mintAddr, header: { delegator } } = delegation.data;
    const [delegatorAta] = await findAssociatedTokenPda({ mint: mintAddr, owner: delegator, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    const [receiverAta] = await findAssociatedTokenPda({ mint: mintAddr, owner: address(receiverAddress), tokenProgram: TOKEN_PROGRAM_ADDRESS });
    return sendKitInstructions(
      [
        getCreateAssociatedTokenIdempotentInstruction({ payer: noopSigner, ata: receiverAta, owner: address(receiverAddress), mint: mintAddr, tokenProgram: TOKEN_PROGRAM_ADDRESS }) as unknown as Instruction,
        await getTransferIx(noopSigner, delegatorAta, receiverAta),
      ],
      noopSigner, solanaAccount
    );
  }

  const createFixedMutation = useMutation({
    mutationFn: async ({ delegateeAddress, amount, expiryTs, nonce }: { delegateeAddress: string; amount: bigint; expiryTs: bigint; nonce: bigint }) => {
      if (!solanaAccount) throw new Error("Wallet not connected");
      const rpc = await getKitRpc(solanaAccount);
      const userAddr = address(solanaAccount.address);
      const noopSigner = createNoopSigner(userAddr);
      const instructions = await ensureAuthority(rpc, userAddr, noopSigner);
      instructions.push(await getCreateFixedDelegationOverlayInstructionAsync({ delegator: noopSigner, tokenMint: address(tokenMintStr), delegatee: address(delegateeAddress), nonce, amount, expiryTs }));
      return sendKitInstructions(instructions, noopSigner, solanaAccount);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["delegations", "outgoing", solanaAccount?.address] }); },
  });

  const createRecurringMutation = useMutation({
    mutationFn: async ({ delegateeAddress, amountPerPeriod, periodLengthS, startTs, expiryTs, nonce }: { delegateeAddress: string; amountPerPeriod: bigint; periodLengthS: bigint; startTs: bigint; expiryTs: bigint; nonce: bigint }) => {
      if (!solanaAccount) throw new Error("Wallet not connected");
      const rpc = await getKitRpc(solanaAccount);
      const userAddr = address(solanaAccount.address);
      const noopSigner = createNoopSigner(userAddr);
      const instructions = await ensureAuthority(rpc, userAddr, noopSigner);
      instructions.push(await getCreateRecurringDelegationOverlayInstructionAsync({ delegator: noopSigner, tokenMint: address(tokenMintStr), delegatee: address(delegateeAddress), nonce, amountPerPeriod, periodLengthS, startTs, expiryTs }));
      return sendKitInstructions(instructions, noopSigner, solanaAccount);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["delegations", "outgoing", solanaAccount?.address] }); },
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ delegationAddress }: { delegationAddress: string }) => {
      if (!solanaAccount) throw new Error("Wallet not connected");
      const noopSigner = createNoopSigner(address(solanaAccount.address));
      return sendKitInstructions(
        [getRevokeDelegationOverlayInstruction({ authority: noopSigner, delegationAccount: address(delegationAddress) })],
        noopSigner, solanaAccount
      );
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["delegations", "outgoing", solanaAccount?.address] }); },
  });

  const invalidateIncoming = () => { queryClient.invalidateQueries({ queryKey: ["delegations", "incoming", solanaAccount?.address] }); };

  const claimFixedMutation = useMutation({
    mutationFn: ({ delegation, receiverAddress }: { delegation: Extract<DelegationWithAddress, { kind: "fixed" }>; receiverAddress: string }) =>
      claimTransfer(receiverAddress, delegation, (signer, delegatorAta, receiverAta) =>
        getTransferFixedOverlayInstructionAsync({ delegatee: signer, delegationPda: delegation.address, delegator: delegation.data.header.delegator, delegatorAta, receiverAta, tokenMint: delegation.data.mint, tokenProgram: TOKEN_PROGRAM_ADDRESS, amount: delegation.data.amount })
      ),
    onSuccess: invalidateIncoming,
  });

  const claimRecurringMutation = useMutation({
    mutationFn: ({ delegation, receiverAddress, amount }: { delegation: Extract<DelegationWithAddress, { kind: "recurring" }>; receiverAddress: string; amount: bigint }) => {
      if (amount === 0n) throw new Error("Nothing available to claim this period");
      return claimTransfer(receiverAddress, delegation, (signer, delegatorAta, receiverAta) =>
        getTransferRecurringOverlayInstructionAsync({ delegatee: signer, delegationPda: delegation.address, delegator: delegation.data.header.delegator, delegatorAta, receiverAta, tokenMint: delegation.data.mint, tokenProgram: TOKEN_PROGRAM_ADDRESS, amount })
      );
    },
    onSuccess: invalidateIncoming,
  });

  return { outgoingDelegations, incomingDelegations, loadingOutgoing, loadingIncoming, createFixedMutation, createRecurringMutation, revokeMutation, claimFixedMutation, claimRecurringMutation };
}

export function useWalletBalances() {
  const { solanaAccount } = useWallet();
  const tokenMintStr = process.env.NEXT_PUBLIC_TOKEN_MINT ?? "";

  const { data, isLoading: loading } = useQuery({
    queryKey: ["balances", solanaAccount?.address],
    queryFn: async () => {
      const rpc = await getKitRpc(solanaAccount!);
      const userAddr = address(solanaAccount!.address);
      const [solResult, tokenBalance] = await Promise.all([
        rpc.getBalance(userAddr).send(),
        tokenMintStr
          ? findAssociatedTokenPda({ mint: address(tokenMintStr), owner: userAddr, tokenProgram: TOKEN_PROGRAM_ADDRESS })
              .then(([ata]) => rpc.getTokenAccountBalance(ata).send())
              .then((r) => BigInt(r.value.amount))
              .catch(() => 0n)
          : Promise.resolve(0n),
      ]);
      return { solBalance: solResult.value, tokenBalance };
    },
    enabled: !!solanaAccount,
    refetchInterval: 30_000,
  });

  return { solBalance: data?.solBalance ?? 0n, tokenBalance: data?.tokenBalance ?? 0n, tokenMintStr, loading };
}
