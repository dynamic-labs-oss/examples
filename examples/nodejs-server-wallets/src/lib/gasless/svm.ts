/**
 * Dynamic Native Gas Sponsorship (SVM)
 *
 * Solana sponsorship works differently from the EVM side, and more simply.
 * There is no delegation contract, no EIP-712 intent, and no relayer: Dynamic
 * takes your unsigned transaction, swaps the **fee payer** for its own sponsor
 * account, signs as that fee payer, and hands the transaction back. Your server
 * then adds the wallet's signature and broadcasts it itself.
 *
 * Two consequences worth understanding:
 *
 *  1. **Order matters.** Replacing the fee payer changes the transaction
 *     message, and therefore what gets signed. Sponsorship must happen *before*
 *     the wallet signs, or the signature covers a stale message and the
 *     transaction is rejected.
 *  2. **You broadcast.** Unlike EVM, no relayer submits for you, so an RPC
 *     endpoint is required and the transaction lands as soon as you send it.
 *
 * ## Two signing paths
 *
 * **Server wallets** use `signTransaction({ sponsor: true })`, which since SDK
 * 1.0.107 sponsors, signs, attaches the signature, and returns the transaction in
 * one call.
 *
 * **Delegated wallets** have to split it: they hold no caller-side key shares, so
 * `signTransaction` cannot sign for them. We call `sponsorTransaction()` explicitly
 * (API-token auth, no wallet key material), then sign with
 * `delegatedSignTransaction`, passing `signerAddress` — without it the SDK would
 * sign as the fee payer, which is now the sponsor, and we have no authority for
 * that account.
 *
 * Note this deliberately avoids the "custom fee payer" pattern in Dynamic's
 * docs, which requires your server to hold a funded Solana private key. Letting
 * Dynamic be the fee payer keeps raw key material out of the picture entirely.
 *
 * ## Requirements
 *
 * Gas sponsorship must be enabled for your environment in the Dynamic dashboard.
 *
 * ## Retries
 *
 * These functions are **not** retry-safe, because they **rebuild**. A fresh build
 * takes a fresh blockhash, which changes the message and therefore the transaction
 * id, so the retry executes a second time. (Re-signing alone is not the problem
 * when sponsored: the id is the sponsor's signature, so Solana dedupes it.)
 * Persist the signed bytes and rebroadcast those instead — see IDEMPOTENCY.md.
 */

import type { ServerKeyShare, WalletMetadata } from "@dynamic-labs-wallet/node";
import {
  type DelegatedSvmWalletClient,
  delegatedSignTransaction,
  type DynamicSvmWalletClient,
  sendTransaction,
} from "@dynamic-labs-wallet/node-svm";
import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";

import { SOLANA_RPC_URL, SVM_CHAIN_ID } from "../../../constants";
import type { DelegatedCredentialsBase } from "../delegated-credentials";

/**
 * Credentials a user grants when delegating their Solana wallet to your app.
 *
 * Structurally identical to the shared base — Solana addresses are base58, so
 * `address` stays a plain string. (EVM's variant narrows it to `Hex`.)
 */
export type DelegatedCredentials = DelegatedCredentialsBase;

/** Parameters for sponsoring from a server wallet you hold key shares for. */
export interface SendSponsoredTransactionOptions {
  svmClient: DynamicSvmWalletClient;
  walletMetadata: WalletMetadata;
  /** Omit when the shares are backed up to Dynamic and recovered by password. */
  externalServerKeyShares?: ServerKeyShare[];
  /** Unsigned transaction. Its fee payer is replaced by Dynamic's sponsor. */
  transaction: Transaction | VersionedTransaction;
  password?: string;
  rpcUrl?: string;
}

/**
 * Parameters for sponsoring from a wallet a user delegated to you.
 *
 * No API-token client needed: `sponsor: true` has the delegated client request
 * sponsorship itself. `userId` travels on `credentials`, from the same webhook.
 */
export interface SendDelegatedSponsoredTransactionOptions {
  /** Delegated client, used to sponsor and to sign with the user's delegated share. */
  delegatedClient: DelegatedSvmWalletClient;
  credentials: DelegatedCredentials;
  transaction: Transaction | VersionedTransaction;
  rpcUrl?: string;
}

/**
 * Send a gasless Solana transaction from a server wallet you hold key shares for.
 */
export async function sendSponsoredTransaction(
  options: SendSponsoredTransactionOptions,
): Promise<string> {
  const signed = await signSponsoredTransaction(options);
  return broadcastSigned(signed, options.rpcUrl ?? SOLANA_RPC_URL);
}

/**
 * Sponsor and sign, without broadcasting.
 *
 * Split out because it is the only way to retry safely: rebuilding takes a fresh
 * blockhash, which changes the transaction id and executes again. Hold the result,
 * and rebroadcast these exact bytes on retry rather than rebuilding. See
 * IDEMPOTENCY.md.
 *
 * `sponsor: true` does the whole job in one call as of SDK 1.0.107: it sponsors,
 * signs the sponsored message, attaches the signature, and returns the transaction
 * alongside it. The signed message and the broadcast message are therefore identical
 * by construction. (Before 1.0.107 the flag sponsored into a local variable and
 * returned only a signature, so the caller never got the transaction that was
 * signed — which is why this used to sponsor and attach by hand.)
 */
export async function signSponsoredTransaction({
  svmClient,
  walletMetadata,
  externalServerKeyShares,
  transaction,
  password,
}: SendSponsoredTransactionOptions): Promise<
  Transaction | VersionedTransaction
> {
  const result = await svmClient.signTransaction({
    walletMetadata,
    ...(externalServerKeyShares?.length ? { externalServerKeyShares } : {}),
    transaction,
    sponsor: true,
    chainId: SVM_CHAIN_ID,
    ...(password && { password }),
  });

  // `signTransaction` returns a bare signature string when not sponsoring, and
  // `{ signature, transaction }` when it does. We always sponsor here.
  if (typeof result === "string") {
    throw new Error(
      "Expected signTransaction({ sponsor: true }) to return the sponsored " +
        "transaction, got a bare signature.",
    );
  }

  return result.transaction;
}

/**
 * Pull the signature out of `signTransaction`'s union return.
 *
 * It resolves to a bare string unless `sponsor: true` was passed, in which case it
 * resolves to `{ signature, transaction }`. Callers that sponsor separately — the
 * delegated path, and the non-sponsored `standard` demo — want the signature.
 */
export function signatureOf(result: string | { signature: string }): string {
  return typeof result === "string" ? result : result.signature;
}

/**
 * Send a gasless Solana transaction from a delegated wallet.
 *
 * Sponsors first so the fee payer is final, then signs the sponsored message
 * with the user's delegated share.
 */
export async function sendDelegatedSponsoredTransaction(
  options: SendDelegatedSponsoredTransactionOptions,
): Promise<string> {
  const signed = await signDelegatedSponsoredTransaction(options);
  return broadcastSigned(signed, options.rpcUrl ?? SOLANA_RPC_URL);
}

/**
 * Sponsor and sign with delegated credentials, without broadcasting.
 *
 * `sponsor: true` does both steps in one call as of SDK 1.0.106 — it requests
 * sponsorship, then signs the *sponsored* message, so the order that matters here
 * is guaranteed by construction rather than by the caller sequencing it.
 *
 * `signerAddress` is still required: without it the SDK signs as the fee payer,
 * which sponsorship has just replaced with Dynamic's sponsor account — and we have
 * no authority for that. `userId` attributes the sponsorship to the wallet's owner.
 *
 * Same reasoning as `signSponsoredTransaction`: hold these bytes for retries.
 */
export async function signDelegatedSponsoredTransaction({
  delegatedClient,
  credentials,
  transaction,
}: SendDelegatedSponsoredTransactionOptions): Promise<
  Transaction | VersionedTransaction
> {
  return delegatedSignTransaction(delegatedClient, {
    walletId: credentials.walletId,
    walletApiKey: credentials.walletApiKey,
    keyShare: credentials.keyShare,
    ...(credentials.shareSetId && { shareSetId: credentials.shareSetId }),
    transaction,
    signerAddress: credentials.address,
    sponsor: true,
    userId: requireUserId(credentials),
    chainId: SVM_CHAIN_ID,
  });
}

/** Serialize a signed transaction to base64, for persisting across retries. */
export function serializeSigned(
  transaction: Transaction | VersionedTransaction,
): string {
  assertFullySigned(transaction);
  return Buffer.from(transaction.serialize()).toString("base64");
}

/**
 * Broadcast previously persisted bytes.
 *
 * Solana dedups identical signatures, so resending the same bytes is safe — it
 * returns the original signature rather than executing again.
 */
export async function broadcastSerialized(
  base64: string,
  rpcUrl: string = SOLANA_RPC_URL,
): Promise<string> {
  return submitAndConfirm(Buffer.from(base64, "base64"), rpcUrl);
}

/** Whether a previously broadcast signature reached the chain. */
export type SignatureOutcome = "landed" | "failed" | "unknown";

/**
 * Resolve a prior attempt without ever re-signing.
 *
 * Two steps, and the order is the point:
 *
 *  1. **Ask the chain**, if a signature was recorded. If it already landed there
 *     is nothing to do and nothing to spend. This is the SVM analogue of polling
 *     an EVM relay's `requestId`, and it is the only step that keeps working once
 *     the stored blockhash has expired.
 *  2. **Rebroadcast the stored bytes.** Only reached when the chain has no record —
 *     the crash-between-persist-and-broadcast case. Solana dedupes identical
 *     transaction ids, so this is safe even if step 1 raced.
 *
 * Rebroadcasting first would be wasteful, and past the blockhash window it fails
 * with `Blockhash not found` on an operation that had actually succeeded — which
 * reads as "not executed" and invites a double dispatch.
 */
export async function resolvePriorBroadcast({
  signedTransaction,
  recordedSignature,
  rpcUrl = SOLANA_RPC_URL,
  onStatus,
}: {
  signedTransaction: string;
  recordedSignature?: string;
  rpcUrl?: string;
  /** Optional progress reporting, for the CLI examples. */
  onStatus?: (message: string) => void;
}): Promise<string> {
  if (recordedSignature) {
    const outcome = await getSignatureOutcome(recordedSignature, rpcUrl);
    onStatus?.(
      `Recorded signature ${recordedSignature} — chain says: ${outcome}`,
    );

    if (outcome === "landed") return recordedSignature;

    if (outcome === "failed") {
      // The signature is spent on-chain as a failure. Rebroadcasting cannot change
      // that, and re-signing would be a *new* transaction — a real second attempt,
      // which is a business decision rather than a retry.
      throw new SvmExecutionFailedError(
        recordedSignature,
        "recorded as failed",
      );
    }
  }

  onStatus?.("Rebroadcasting stored bytes verbatim — no re-signing.");

  try {
    return await broadcastSerialized(signedTransaction, rpcUrl);
  } catch (error) {
    if (!isBlockhashExpired(error)) throw error;

    // Note what this does and does not tell us: the *bytes* can never execute now,
    // which is why no double-spend is possible from here. It says nothing about
    // whether the operation already succeeded — and if no signature was recorded,
    // we have no way left to ask.
    throw new Error(
      `The stored transaction's blockhash has expired (~60-90s validity), so these ` +
        `bytes can never execute — no double-spend is possible from here. But the ` +
        `operation's outcome is unknown${
          recordedSignature ? "" : ", and no signature was recorded to query"
        }. Do not rebuild and re-sign without checking business state first: that ` +
        `would be a second independently executable transaction. See IDEMPOTENCY.md.`,
    );
  }
}

/** Blockhash expiry, which ends a stored transaction's life rather than failing it. */
function isBlockhashExpired(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Blockhash not found") ||
    message.includes("block height exceeded")
  );
}

/**
 * Ask the chain what happened to a signature.
 *
 * The SVM analogue of polling an EVM relay's `requestId`: check the prior attempt
 * before broadcasting anything. It matters more here than on EVM, because stored
 * bytes stop being rebroadcastable once their blockhash expires (~60-90s) — so
 * "rebroadcast the bytes" is not a retry strategy that works indefinitely, while
 * this lookup keeps working via `searchTransactionHistory`.
 *
 * `unknown` means the chain has no record: either it never landed, or it has aged
 * out of the queried history. Treat it as "not confirmed", never as "safe to
 * re-sign".
 */
export async function getSignatureOutcome(
  signature: string,
  rpcUrl: string = SOLANA_RPC_URL,
): Promise<SignatureOutcome> {
  const connection = new Connection(rpcUrl, "confirmed");

  const { value } = await connection.getSignatureStatus(signature, {
    searchTransactionHistory: true,
  });

  if (!value) return "unknown";
  if (value.err) return "failed";

  // `processed` is not durable — it can still be dropped on a fork. Since this
  // function stands in for an EVM receipt, only a confirmed/finalized commitment
  // counts as landed.
  return value.confirmationStatus === "processed" ? "unknown" : "landed";
}

/**
 * Serialize, broadcast, and wait for confirmation.
 *
 * Every required signature must be present before serializing — a partially
 * signed transaction fails at `serialize()` rather than on-chain, which is the
 * clearer failure.
 */
export async function broadcastSigned(
  transaction: Transaction | VersionedTransaction,
  rpcUrl: string = SOLANA_RPC_URL,
): Promise<string> {
  assertFullySigned(transaction);
  return submitAndConfirm(transaction.serialize(), rpcUrl);
}

/**
 * A transaction that reached the chain and failed there.
 *
 * Distinguished from a transport error because the two demand opposite responses:
 * this one carries a signature, the operation is settled (as a failure), and
 * resending the same bytes can never change that. A transport error means the
 * outcome is simply unknown.
 */
export class SvmExecutionFailedError extends Error {
  constructor(
    readonly signature: string,
    readonly transactionError: unknown,
  ) {
    super(
      `Transaction ${signature} landed but failed on-chain: ` +
        `${JSON.stringify(transactionError)}`,
    );
    this.name = "SvmExecutionFailedError";
  }
}

/**
 * Submit signed bytes and confirm them, treating an on-chain failure as a failure.
 *
 * The subtlety worth knowing: **`confirmTransaction` does not throw when the
 * transaction fails on-chain.** It resolves with the error in its value —
 * `SignatureResult` is `{ err: TransactionError | null }`. So `await
 * connection.confirmTransaction(sig)` without reading `value.err` reports a
 * reverted transaction as a success, and callers persist that as a terminal,
 * immutable record. Read the value.
 */
async function submitAndConfirm(
  bytes: Uint8Array,
  rpcUrl: string,
): Promise<string> {
  const signature = await sendTransaction({
    signedTransaction: bytes,
    rpcUrl,
  });

  const connection = new Connection(rpcUrl, "confirmed");
  const { value } = await connection.confirmTransaction(signature, "confirmed");

  if (value.err) throw new SvmExecutionFailedError(signature, value.err);

  return signature;
}

/**
 * Surface missing signatures by signer, rather than a generic serialize error.
 *
 * A sponsored transaction needs two: Dynamic's sponsor as fee payer (which the
 * sponsorship response already carries) and the wallet as instruction signer.
 * Naming the missing one turns an opaque failure into an obvious diagnosis —
 * usually a wrong or absent `signerAddress` on the delegated path.
 */
function assertFullySigned(
  transaction: Transaction | VersionedTransaction,
): void {
  const unsigned =
    transaction instanceof VersionedTransaction
      ? findUnsignedVersioned(transaction)
      : transaction.signatures
          .filter((entry) => entry.signature === null)
          .map((entry) => entry.publicKey.toBase58());

  if (unsigned.length > 0) {
    throw new Error(`Missing signatures for: ${unsigned.join(", ")}`);
  }
}

/**
 * Versioned transactions keep signatures in a bare array positionally aligned
 * with the first `numRequiredSignatures` static account keys, and pre-fill unset
 * slots with zeroes rather than null.
 */
function findUnsignedVersioned(transaction: VersionedTransaction): string[] {
  const keys = transaction.message.staticAccountKeys;
  const required = transaction.message.header.numRequiredSignatures;

  return transaction.signatures
    .slice(0, required)
    .map((signature, index) =>
      signature.every((byte) => byte === 0) ? keys[index].toBase58() : null,
    )
    .filter((address): address is string => address !== null);
}

/**
 * Sponsorship needs the wallet owner's `userId`; plain signing does not.
 *
 * Checked here rather than when loading credentials, so message signing keeps
 * working on a `wallet.json` that predates this requirement.
 */
function requireUserId(credentials: DelegatedCredentials): string {
  if (!credentials.userId) {
    throw new Error(
      "userId is required to sponsor a delegated transaction — a delegated wallet " +
        "is always owned by an end user, so the sponsorship has to be attributed to " +
        "them. Add the `userId` from your wallet.delegation.created webhook to " +
        "wallet.json.",
    );
  }

  return credentials.userId;
}
