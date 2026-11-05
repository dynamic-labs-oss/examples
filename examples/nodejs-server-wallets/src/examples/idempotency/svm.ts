/**
 * Idempotent Sponsored Transaction — SVM
 *
 * The rule from the EVM side **inverts** here, and getting it backwards
 * double-spends.
 *
 * There is no delegate contract, no intent, and no nonce to pin: Dynamic sponsors
 * by replacing the fee payer, and your server broadcasts. So nothing on-chain
 * dedupes "the same logical operation" — Solana only dedupes *identical signed
 * bytes*.
 *
 * ## Where the hazard actually is: rebuilding, not re-signing
 *
 * A Solana transaction's id is `signatures[0]` — the **fee payer's** signature.
 * Under sponsorship the fee payer is Dynamic's sponsor, not the wallet, and that
 * changes which step is dangerous. Measured on devnet:
 *
 *   - MPC Ed25519 signing *is* non-deterministic: signing one message twice yields
 *     two different, both-valid wallet signatures.
 *   - But those are `signatures[1]`. The transaction id is unchanged, so
 *     broadcasting either is **one** execution — Solana dedupes them.
 *   - Re-sponsoring the same built transaction is fully deterministic: same fee
 *     payer, same message bytes, same sponsor signature, same id.
 *   - **Rebuilding** takes a fresh blockhash. That changes the message, so the
 *     sponsor signature and the id change too — and the operation executes a
 *     second time.
 *
 * So the vector is the rebuild, and specifically the fresh blockhash. (On the
 * non-sponsored path the wallet *is* the fee payer, `signatures[0]` is its MPC
 * signature, and re-signing alone is enough to double-execute.)
 *
 * Either way the safe unit of retry is the **signed bytes**:
 *
 *   sign once -> persist the serialized transaction -> rebroadcast those bytes
 *
 * `--force` below rebuilds on purpose, and the second execution lands.
 *
 * ## What this demo does
 *
 * A 0-lamport self-transfer. No value moves and the sponsor pays the fee, so the
 * wallet needs no SOL — which is the point of sponsorship, and it keeps the demo
 * runnable on a fresh wallet.
 *
 * **The observable is the signature, not a balance.** Unlike the EVM demo (which
 * mints USDC, so a double execution shows as double the balance), there is no
 * free-mint equivalent on Solana devnet. So this demo reports the transaction
 * signature: one signature across runs means one execution, and two distinct
 * signatures mean the operation ran twice. The lamport balance is reported only to
 * show the wallet paid nothing — it stays flat either way.
 */

import type { Transaction, VersionedTransaction } from "@solana/web3.js";

import { SOLANA_RPC_URL, SVM_CHAIN_ID } from "../../../constants";

import {
  authenticatedSvmClient,
  getLamportBalance,
  type SvmClient,
} from "../../lib/clients/svm";
import {
  broadcastSigned,
  resolvePriorBroadcast,
  serializeSigned,
  signSponsoredTransaction,
  signatureOf,
} from "../../lib/gasless/svm";
import { getTransfer, patchTransfer, putTransfer } from "../../lib/transfer/store";
import { getSolanaTransactionLink } from "../../lib/utils";
import { getOrCreateWallet, type WalletInfo } from "../../lib/wallet-helpers";
import { buildDemoTransfer } from "../../svm/transaction";
import type { IdempotencyDemoOptions } from "./types";

const formatSol = (lamports: number) => `${lamports / 1e9} SOL (${lamports} lamports)`;

/**
 * Sign an already-sponsored transaction with the wallet's key shares.
 *
 * Returns the base58 signature rather than the transaction, so callers can sign
 * the *same* message more than once and compare — which is what makes the
 * non-determinism in `--force` visible.
 */
async function signSponsored(
  svmClient: SvmClient,
  wallet: WalletInfo,
  // Sponsorship returns whichever shape it was given; `buildDemoTransfer` builds
  // v0, but the SDK's signature is the wider union.
  sponsored: Transaction | VersionedTransaction,
  password?: string,
): Promise<string> {
  // No `sponsor: true` — this message is already sponsored, and we want only the
  // wallet's signature so the caller can compare two signings of one message.
  return signatureOf(
    await svmClient.signTransaction({
      walletMetadata: wallet.walletMetadata,
      ...(wallet.externalServerKeyShares.length > 0 && {
        externalServerKeyShares: wallet.externalServerKeyShares,
      }),
      transaction: sponsored,
      chainId: SVM_CHAIN_ID,
      ...(password && { password }),
    }),
  );
}

/**
 * The safe path: sign once, persist the bytes, then broadcast.
 *
 * Persisting *before* broadcasting is the load-bearing ordering. Crash after
 * broadcast but before the write and you have a transaction on-chain you hold no
 * record of — and the only safe retry (rebroadcasting those exact bytes) is now
 * impossible, because the bytes are gone.
 */
async function signPersistAndBroadcast(
  svmClient: SvmClient,
  wallet: WalletInfo,
  orderId: string,
  password?: string,
): Promise<string> {
  const transaction = await buildDemoTransfer({ senderAddress: wallet.address });

  console.info(`\nNo prior attempt recorded for "${orderId}"`);
  console.info(`Sponsoring and signing once...`);

  const signed = await signSponsoredTransaction({
    svmClient,
    walletMetadata: wallet.walletMetadata,
    externalServerKeyShares: wallet.externalServerKeyShares,
    transaction,
    password,
  });

  const bytes = serializeSigned(signed);
  putTransfer({
    key: orderId,
    chain: "svm",
    status: "pending",
    from: wallet.address,
    to: wallet.address,
    signedTransaction: bytes,
    createdAt: new Date().toISOString(),
  });
  console.info(`Signed bytes persisted under "${orderId}" (${bytes.length} base64 chars)`);
  console.info(`  These bytes — not the order id — are the idempotency key.`);

  const signature = await broadcastSigned(signed, SOLANA_RPC_URL);
  patchTransfer(orderId, { status: "success", transactionId: signature });
  return signature;
}

/**
 * Deliberately rebuild the operation, to show what actually double-executes.
 *
 * Two parts, because the intuitive answer is wrong:
 *
 *  1. Sponsor once, then sign that identical message twice. The two wallet
 *     signatures differ — MPC is non-deterministic — but they occupy
 *     `signatures[1]`, so the transaction id (the sponsor's `signatures[0]`) is
 *     unchanged. This is *not* a double-execution vector.
 *  2. Rebuild from scratch. The fresh blockhash changes the message, so the
 *     sponsor's signature and the id change with it, and this one lands as a
 *     genuine second execution. There is no EVM-style nonce bitmap to stop it.
 *
 * Safe to run only because this demo moves 0 lamports.
 */
async function forceRebuildAndBroadcast(
  svmClient: SvmClient,
  wallet: WalletInfo,
  priorSignature: string | undefined,
  password?: string,
): Promise<string> {
  console.info(`\n--force: attempting the same operation a second time.`);

  // Part 1: the non-vector. Sponsor once so both signatures cover an identical
  // message, which isolates MPC non-determinism from every other difference.
  const original = await buildDemoTransfer({ senderAddress: wallet.address });
  const sponsored = await svmClient.sponsorTransaction({ transaction: original });

  const first = await signSponsored(svmClient, wallet, sponsored, password);
  const second = await signSponsored(svmClient, wallet, sponsored, password);

  console.info(`\n1. Same message, signed twice (MPC is non-deterministic):`);
  console.info(`   wallet sig A: ${first.slice(0, 24)}...`);
  console.info(`   wallet sig B: ${second.slice(0, 24)}...`);
  console.info(`   different: ${first !== second}`);
  console.info(
    `   ...but these are signatures[1]. The transaction id is signatures[0] —`,
  );
  console.info(
    `   the sponsor's, as fee payer — so both share one id and Solana dedupes`,
  );
  console.info(`   them. Re-signing alone does NOT execute twice.`);

  // Part 2: the real vector. A fresh build takes a fresh blockhash, so the
  // message — and therefore the id — is genuinely new.
  console.info(`\n2. Rebuilding with a fresh blockhash instead:`);

  const rebuilt = await buildDemoTransfer({ senderAddress: wallet.address });
  const signed = await signSponsoredTransaction({
    svmClient,
    walletMetadata: wallet.walletMetadata,
    externalServerKeyShares: wallet.externalServerKeyShares,
    transaction: rebuilt,
    password,
  });

  // Deliberately not persisted: the stored record is the first run's bytes, and
  // overwriting it would destroy the only safe retry unit.
  const signature = await broadcastSigned(signed, SOLANA_RPC_URL);

  console.info(`   Second execution landed: ${signature}`);
  if (priorSignature) {
    console.info(`   First execution was:     ${priorSignature}`);
    console.info(
      `\n   Two distinct transaction ids for one order id — it ran twice.`,
    );
  }

  return signature;
}

/** Run the SVM demo. Called by the dispatcher in `index.ts`. */
export async function runSvmIdempotencyDemo({
  orderId,
  address,
  password,
  force,
  amount,
}: IdempotencyDemoOptions): Promise<void> {
  // Flagged rather than ignored silently: a caller passing --amount here is
  // expecting value to move, and it will not.
  if (amount !== undefined) {
    console.error(
      `--amount is EVM-only (it mints test USDC). The SVM demo is a 0-lamport`,
    );
    console.error(
      `self-transfer, since Solana devnet has no equivalent free mint.`,
    );
    process.exit(1);
  }

  console.info(`Operation: 0-lamport self-transfer (sponsored)`);
  console.info("=".repeat(60));

  const prior = getTransfer(orderId);

  // The safe retry short-circuits here, before any wallet is touched.
  //
  // Rebroadcasting stored bytes needs no key shares, no client, and no wallet —
  // the transaction is already signed. That is worth showing rather than
  // obscuring: a retry worker can be entirely unprivileged. Creating a wallet
  // first would also mean a fresh throwaway wallet on every replay when
  // `--address` is omitted, and a balance readout for an account unrelated to the
  // transaction being replayed.
  if (!force && prior?.signedTransaction) {
    console.info("");
    console.info(`Found stored bytes for "${orderId}"`);

    const signature = await resolvePriorBroadcast({
      signedTransaction: prior.signedTransaction,
      recordedSignature: prior.transactionId,
      rpcUrl: SOLANA_RPC_URL,
      onStatus: (message) => console.info(`  ${message}`),
    });

    report({
      signature,
      executed: false,
      walletAddress: prior.from,
      balanceAfter: await getLamportBalance(prior.from),
      force,
      orderId,
    });
    return;
  }

  console.info("");
  const svmClient = await authenticatedSvmClient();
  const wallet = await getOrCreateWallet(svmClient, address, password);

  const balanceBefore = await getLamportBalance(wallet.address);
  console.info(`\nBalance before: ${formatSol(balanceBefore)}`);

  let signature: string;

  if (force) {
    signature = await forceRebuildAndBroadcast(
      svmClient,
      wallet,
      prior?.transactionId,
      password,
    );
  } else {
    // Covers both a first run and a record written before the bytes were stored.
    if (prior) {
      console.info(
        `\nPrior record for "${orderId}" has no stored bytes — signing fresh.`,
      );
    }
    signature = await signPersistAndBroadcast(
      svmClient,
      wallet,
      orderId,
      password,
    );
  }

  report({
    signature,
    executed: true,
    walletAddress: wallet.address,
    balanceAfter: await getLamportBalance(wallet.address),
    force,
    orderId,
  });
}

/** Final summary, shared by the replay short-circuit and the signing paths. */
function report({
  signature,
  executed,
  walletAddress,
  balanceAfter,
  force,
  orderId,
}: {
  signature: string;
  executed: boolean;
  walletAddress: string;
  balanceAfter: number;
  force: boolean;
  orderId: string;
}): void {
  console.info("");
  console.info("=".repeat(60));
  console.info(`Signature: ${signature}`);
  console.info(`Explorer: ${getSolanaTransactionLink(signature)}`);
  console.info(`Executed this run: ${executed ? "yes" : "no"}`);
  console.info(`Balance after: ${formatSol(balanceAfter)}`);
  console.info(
    `  (flat by design — 0 lamports moved and the sponsor paid the fee)`,
  );
  console.info("");
  console.info(`Wallet: ${walletAddress}`);
  console.info(
    force
      ? `Re-run without --force — the stored bytes replay to the first signature.`
      : `Re-run with --order-id ${orderId} — the signature should be identical.`,
  );
  console.info("=".repeat(60));
}
