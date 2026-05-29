"use client";

import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Blockhash,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";
import { VersionedTransaction } from "@solana/web3.js";
import { getActiveNetworkData } from "@dynamic-labs-sdk/client";
import { getSolanaConnection, signAndSendTransaction } from "@dynamic-labs-sdk/solana";
import { dynamicClient } from "@/lib/dynamic";
import { useWallet } from "@/lib/useWallet";

// Builds a kit v6 transaction, sends it via the Dynamic embedded wallet,
// and waits for on-chain confirmation before returning.
export async function sendKitInstructions(
  instructions: Instruction[],
  feePayer: TransactionSigner,
  walletAccount: ReturnType<typeof useWallet>["solanaAccount"],
): Promise<string> {
  if (!walletAccount) throw new Error("Wallet not connected");

  // Use the same RPC the WaaS provider uses so the blockhash is in its node's cache.
  const { networkData } = await getActiveNetworkData({ walletAccount }, dynamicClient);
  if (!networkData) throw new Error("Could not determine active Solana network");

  const connection = getSolanaConnection({ networkData });

  // web3.js Connection API — returns plain string/number, cast to kit branded types
  const { blockhash: rawBlockhash, lastValidBlockHeight: rawLastValid } =
    await connection.getLatestBlockhash("confirmed");
  const blockhash = rawBlockhash as Blockhash;
  const lastValidBlockHeight = BigInt(rawLastValid);

  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );

  const versionedTx = VersionedTransaction.deserialize(
    Buffer.from(getBase64EncodedWireTransaction(compileTransaction(txMessage)), "base64"),
  );

  let signature: string;
  try {
    const { signature: sig } = await signAndSendTransaction(
      { transaction: versionedTx, walletAccount, options: { skipPreflight: true } },
      dynamicClient,
    );
    signature = sig;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("no record of a prior credit") || msg.includes("debit an account")) {
      throw new Error("Your wallet has no SOL for transaction fees.");
    }
    throw err;
  }

  // Poll for confirmation using the same web3.js Connection
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      if (status.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
      return signature;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return signature; // return anyway after timeout — tx may still land
}
