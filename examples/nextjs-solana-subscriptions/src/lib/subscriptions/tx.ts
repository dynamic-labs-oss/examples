"use client";

import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";
import { VersionedTransaction } from "@solana/web3.js";
import { signAndSendTransaction } from "@dynamic-labs-sdk/solana";
import { dynamicClient } from "@/lib/dynamic";
import { useWallet } from "@/lib/providers";

// Builds a kit v6 transaction and sends it via the Dynamic embedded wallet
export async function sendKitInstructions(
  instructions: Instruction[],
  feePayer: TransactionSigner,
  rpc: ReturnType<typeof createSolanaRpc>,
  walletAccount: ReturnType<typeof useWallet>["solanaAccount"]
): Promise<string> {
  if (!walletAccount) throw new Error("Wallet not connected");

  const { value: { blockhash, lastValidBlockHeight } } = await rpc
    .getLatestBlockhash({ commitment: "finalized" })
    .send();

  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, m),
    (m) => appendTransactionMessageInstructions(instructions, m)
  );

  const versionedTx = VersionedTransaction.deserialize(
    Buffer.from(getBase64EncodedWireTransaction(compileTransaction(txMessage)), "base64")
  );

  try {
    const result = await signAndSendTransaction({ transaction: versionedTx, walletAccount }, dynamicClient);
    return (result as { signature: string }).signature ?? (result as unknown as string);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("no record of a prior credit") || msg.includes("debit an account")) {
      throw new Error("Your wallet has no SOL for transaction fees.");
    }
    throw err;
  }
}
