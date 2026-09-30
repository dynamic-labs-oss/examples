/**
 * Demo Transaction Builder (Solana)
 *
 * Demo scaffolding: a fixed no-op transfer, shared by the `src/svm` examples and
 * `src/examples/idempotency/svm.ts`. The unified transfer layer builds real
 * transfers itself in `lib/transfer/svm.ts`.
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { SOLANA_RPC_URL } from "../../constants";

/**
 * Build an unsigned demo transfer.
 *
 * A 0-lamport self-transfer: it moves no value but still requires the wallet's
 * signature, which is exactly what's needed to demonstrate who pays the fee. This
 * mirrors the EVM examples sending 0 to the zero address.
 *
 * ## Why versioned, not legacy
 *
 * Dynamic's sponsorship endpoint always returns a **v0 VersionedTransaction**,
 * whatever you send it, so building v0 up front keeps input and output types
 * aligned and avoids a surprise type change mid-flow.
 *
 * Passing a legacy `Transaction` does work as of SDK 1.0.107 — `sponsorTransaction`
 * now always deserializes the response as versioned. On 1.0.101 and earlier it
 * deserialized by *input* type, so a legacy input threw "Versioned messages must be
 * deserialized with VersionedMessage.deserialize()".
 *
 * `payerKey` is set to the sender. Sponsorship replaces it, but the transaction
 * has to be well-formed before it can be sponsored.
 */
export async function buildDemoTransfer({
  senderAddress,
  rpcUrl = SOLANA_RPC_URL,
}: {
  senderAddress: string;
  rpcUrl?: string;
}): Promise<VersionedTransaction> {
  const connection = new Connection(rpcUrl, "confirmed");
  const sender = new PublicKey(senderAddress);

  // `finalized`, not `confirmed`. Sponsorship and MPC signing add round trips
  // between building and broadcasting, and public RPC endpoints are load
  // balanced — so a just-confirmed blockhash may be unknown to whichever node
  // simulates the transaction, which surfaces as "Blockhash not found".
  // A finalized blockhash is old enough that every node has it.
  const { blockhash } = await connection.getLatestBlockhash("finalized");

  const message = new TransactionMessage({
    payerKey: sender,
    recentBlockhash: blockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: sender,
        toPubkey: sender,
        lamports: 0,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

