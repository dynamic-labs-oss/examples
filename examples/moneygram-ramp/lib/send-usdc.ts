"use client";

import { encodeFunctionData, erc20Abi, parseUnits } from "viem";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import {
  isSolanaWalletAccount,
  signAndSendTransaction,
} from "@dynamic-labs-sdk/solana";
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import type { WalletAccount } from "@dynamic-labs-sdk/client";
import { CHAINS, type MgChain } from "./chains";

/**
 * Send USDC to the given address on the specified chain.
 * Dispatches to EVM or Solana signing based on chain type.
 *
 * @returns Transaction hash (EVM) or signature (Solana)
 */
export async function sendUsdc({
  to,
  amount,
  chain,
  walletAccounts,
}: {
  to: string;
  amount: string;
  chain: MgChain;
  walletAccounts: WalletAccount[];
}): Promise<string> {
  const config = CHAINS[chain];

  // ── EVM (Base Sepolia or Eth Sepolia) ──────────────────────────────────────
  if (config.type === "evm") {
    const evmWallet = walletAccounts.find(isEvmWalletAccount);
    if (!evmWallet) throw new Error("No EVM wallet found. Connect an EVM embedded wallet.");

    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [to as `0x${string}`, parseUnits(amount, 6)],
    });

    const walletClient = await createWalletClientForWalletAccount({
      walletAccount: evmWallet,
    });

    return walletClient.sendTransaction({
      to: config.usdcAddress,
      data,
      value: BigInt(0),
      chain: config.viemChain,
    });
  }

  // ── Solana Devnet ──────────────────────────────────────────────────────────
  const solanaWallet = walletAccounts.find(isSolanaWalletAccount);
  if (!solanaWallet) throw new Error("No Solana wallet found. Connect a Solana embedded wallet.");

  const connection = new Connection(config.rpcUrl, "confirmed");
  const fromPubkey = new PublicKey(solanaWallet.address);
  const toPubkey = new PublicKey(to);
  const mintPubkey = new PublicKey(config.usdcMint);

  const senderATA = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
  const recipientATA = await getAssociatedTokenAddress(mintPubkey, toPubkey);
  const tokenAmount = BigInt(Math.floor(parseFloat(amount) * 1_000_000));

  const instructions = [];

  const recipientInfo = await connection.getAccountInfo(recipientATA);
  if (!recipientInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        fromPubkey,
        recipientATA,
        toPubkey,
        mintPubkey,
      ),
    );
  }

  instructions.push(
    createTransferCheckedInstruction(
      senderATA,
      mintPubkey,
      recipientATA,
      fromPubkey,
      tokenAmount,
      6,
    ),
  );

  const { blockhash } = await connection.getLatestBlockhash("finalized");
  const message = new TransactionMessage({
    payerKey: fromPubkey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  // Type assertion handles potential @solana/web3.js version mismatches
  const txPayload = {
    transaction: tx as unknown as Parameters<typeof signAndSendTransaction>[0]["transaction"],
    walletAccount: solanaWallet,
  };

  const { signature } = await signAndSendTransaction(txPayload);
  return signature;
}
