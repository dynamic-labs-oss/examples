"use client";

import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getBase64Decoder,
  getBase64Encoder,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";
import { VersionedTransaction } from "@solana/web3.js";
import { getActiveNetworkData, getNetworksData, switchActiveNetwork } from "@dynamic-labs-sdk/client";
import { signTransaction, type SolanaWalletAccount } from "@dynamic-labs-sdk/solana";
import { dynamicClient } from "@/lib/dynamic";
import { confirmSignature, solanaRpc } from "./rpc";

const isDevnet = (n?: { networkId?: string | number; vanityName?: string; name?: string; rpcUrls?: { http?: string[] } } | null) =>
  !!n &&
  (String(n.networkId) === "103" ||
    /devnet/i.test(`${n.vanityName ?? ""} ${n.name ?? ""} ${n.rpcUrls?.http?.[0] ?? ""}`));

// Best effort: put the wallet on Solana devnet so the wallet provider's own
// network matches what we submit to. We sign locally and send through our own
// devnet RPC either way, so a failure here is not fatal.
export async function ensureSolanaDevnet(walletAccount: SolanaWalletAccount) {
  try {
    const active = await getActiveNetworkData({ walletAccount }, dynamicClient).catch(() => null);
    if (isDevnet(active?.networkData)) return;
    const devnet = getNetworksData(dynamicClient).find(
      (n) => n.chain === "SOL" && isDevnet(n as never),
    );
    if (devnet) await switchActiveNetwork({ walletAccount, networkId: String(devnet.networkId) }, dynamicClient);
  } catch {
    /* non-fatal */
  }
}

// Builds a v0 transaction from kit instructions, has the Dynamic wallet sign
// it, submits it through our devnet RPC (with preflight, so program errors
// surface as readable messages) and waits for confirmation.
export async function sendKitInstructions(
  instructions: Instruction[],
  feePayer: TransactionSigner,
  walletAccount: SolanaWalletAccount | null,
): Promise<string> {
  if (!walletAccount) throw new Error("Connect a wallet first");
  await ensureSolanaDevnet(walletAccount);
  const rpc = solanaRpc();

  const { value: latest } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latest, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const wire = getBase64EncodedWireTransaction(compileTransaction(message));
  const unsigned = VersionedTransaction.deserialize(new Uint8Array(getBase64Encoder().encode(wire)));

  const { signedTransaction } = await signTransaction({ transaction: unsigned, walletAccount }, dynamicClient);
  const signedBase64 = getBase64Decoder().decode(
    (signedTransaction as VersionedTransaction).serialize(),
  ) as Parameters<typeof rpc.sendTransaction>[0];

  let signature: string;
  try {
    signature = await rpc
      .sendTransaction(signedBase64, { encoding: "base64", preflightCommitment: "confirmed" })
      .send();
  } catch (err) {
    throw new Error(readableSendError(err));
  }
  await confirmSignature(rpc, signature);
  return signature;
}

function readableSendError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const cause = (err as { cause?: { message?: string; context?: { logs?: string[] } } })?.cause;
  const detail = cause?.message ?? msg;
  if (/no record of a prior credit|debit an account/i.test(detail)) {
    return "Your wallet has no devnet SOL for transaction fees. Get some from faucet.solana.com.";
  }
  if (/insufficient funds|0x1\b/i.test(detail)) {
    return "Insufficient token balance. Get devnet USDC from faucet.circle.com.";
  }
  return detail.length > 200 ? `${detail.slice(0, 200)}…` : detail;
}
