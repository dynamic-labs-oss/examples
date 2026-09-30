#!/usr/bin/env tsx

/**
 * Dynamic Solana Transaction Demo
 *
 * Send a Solana transaction from a server wallet, with or without gas sponsorship.
 *
 * ## Usage
 *
 *   pnpm svm:send-txn standard                              # Wallet pays the fee
 *   pnpm svm:send-txn gasless                               # Dynamic sponsors the fee
 *   pnpm svm:send-txn gasless --address <addr>              # Use saved wallet
 *   pnpm svm:send-txn gasless --address <addr> --password   # Password-protected wallet
 *   pnpm svm:send-txn gasless --order-id order-1            # Idempotent: safe to retry
 *
 * ## Modes
 *
 * - **standard**: The wallet is the fee payer, so it needs devnet SOL.
 * - **gasless**: Dynamic replaces the fee payer with its own sponsor account, so
 *   the wallet needs no balance at all.
 *
 * ## How SVM sponsorship differs from EVM
 *
 * There is no delegation contract, no signed intent, and no relayer. Dynamic
 * swaps the fee payer and signs as it; your server broadcasts the transaction
 * itself. Because swapping the fee payer changes the message being signed,
 * sponsorship has to happen before the wallet signs.
 *
 * ## Requirements for gasless
 *
 * Gas sponsorship must be enabled for your environment in the Dynamic dashboard.
 */

import { attachSignature } from "@dynamic-labs-wallet/node-svm";

import { SOLANA_RPC_URL, SVM_CHAIN_ID } from "../../constants";
import { parseArgs, runScript } from "../lib/cli";
import { authenticatedSvmClient, getLamportBalance, type SvmClient } from "../lib/clients/svm";
import {
  broadcastSerialized,
  broadcastSigned,
  sendSponsoredTransaction,
  serializeSigned,
  signSponsoredTransaction,
  signatureOf,
} from "../lib/gasless/svm";

import { getTransfer, patchTransfer, putTransfer } from "../lib/transfer/store";
import { getSolanaTransactionLink } from "../lib/utils";
import { getOrCreateWallet, type WalletInfo } from "../lib/wallet-helpers";
import { buildDemoTransfer } from "./transaction";

type GasMode = "standard" | "gasless";
const VALID_MODES: GasMode[] = ["standard", "gasless"];

/**
 * Step 2a: Send a standard transaction (the wallet pays its own fee)
 */
async function sendTransactionStandard(
  svmClient: SvmClient,
  wallet: WalletInfo,
  password?: string,
) {
  // A fee payer with no SOL produces a confusing RPC error, so check first.
  const lamports = await getLamportBalance(wallet.address);
  if (lamports === 0) {
    console.error(`Wallet has no SOL and cannot pay its own fee.`);
    console.error(`Address: ${wallet.address}`);
    console.error(
      `\nFund it with devnet SOL, or use 'gasless' mode which needs no balance:`,
    );
    console.error(`  pnpm svm:send-txn gasless --address ${wallet.address}`);
    process.exit(1);
  }

  const transaction = await buildDemoTransfer({
    senderAddress: wallet.address,
  });

  console.info(`Sending standard transaction (wallet pays fee)...`);

  // No sponsorship in this mode: the wallet is the fee payer, so this returns a
  // bare signature which we attach ourselves.
  const signatureBase58 = signatureOf(
    await svmClient.signTransaction({
      walletMetadata: wallet.walletMetadata,
      ...(wallet.externalServerKeyShares.length > 0 && {
        externalServerKeyShares: wallet.externalServerKeyShares,
      }),
      transaction,
      ...(password && { password }),
      chainId: SVM_CHAIN_ID,
    }),
  );

  const signed = attachSignature({
    transaction,
    signatureBase58,
    senderAddress: wallet.address,
  });

  // Same broadcast path as the sponsored flow — only the fee payer differs.
  return broadcastSigned(signed, SOLANA_RPC_URL);
}

/**
 * Step 2b: Send a gasless transaction sponsored by Dynamic
 *
 * Pass an `orderId` to make the send idempotent. Unlike EVM there is no nonce to
 * pin, and rebuilding would take a fresh blockhash — a new transaction id, and a
 * second execution. The safe unit is the signed bytes:
 * persist them, and rebroadcast those verbatim on retry. Solana dedups identical
 * signatures, so a rebroadcast cannot execute twice. See IDEMPOTENCY.md.
 */
async function sendTransactionGasless(
  svmClient: SvmClient,
  wallet: WalletInfo,
  password?: string,
  orderId?: string,
) {
  // A previous attempt already signed this: replay it rather than rebuilding.
  if (orderId) {
    const prior = getTransfer(orderId);
    if (prior?.signedTransaction) {
      console.info(`Replaying stored bytes for "${orderId}" (no re-signing)...`);
      return broadcastSerialized(prior.signedTransaction, SOLANA_RPC_URL);
    }
  }

  const transaction = await buildDemoTransfer({
    senderAddress: wallet.address,
  });

  console.info(`Sending gasless transaction (sponsored by Dynamic)...`);
  if (orderId) console.info(`Idempotent: signed bytes stored under "${orderId}"`);

  // Without an orderId there is nothing to persist, so send in one step.
  if (!orderId) {
    return sendSponsoredTransaction({
      svmClient,
      walletMetadata: wallet.walletMetadata,
      externalServerKeyShares: wallet.externalServerKeyShares,
      transaction,
      password,
    });
  }

  const signed = await signSponsoredTransaction({
    svmClient,
    walletMetadata: wallet.walletMetadata,
    externalServerKeyShares: wallet.externalServerKeyShares,
    transaction,
    password,
  });

  // Persist before broadcasting — crashing in between would otherwise strand a
  // transaction that could never be retried safely.
  putTransfer({
    key: orderId,
    chain: "svm",
    status: "pending",
    from: wallet.address,
    to: wallet.address,
    signedTransaction: serializeSigned(signed),
    createdAt: new Date().toISOString(),
  });

  const signature = await broadcastSigned(signed, SOLANA_RPC_URL);
  patchTransfer(orderId, { status: "success", transactionId: signature });
  return signature;
}

runScript(async () => {
  const { positional, getFlag } = parseArgs(process.argv);

  const mode = (positional[0] || "standard") as GasMode;
  const address = getFlag("address");
  const password = getFlag("password");
  const orderId = getFlag("order-id");

  if (!VALID_MODES.includes(mode)) {
    console.error(`Invalid mode: ${mode}`);
    console.error(`Valid modes: ${VALID_MODES.join(", ")}`);
    process.exit(1);
  }

  // Step 1: Get or create wallet
  const svmClient = await authenticatedSvmClient();
  const wallet = await getOrCreateWallet(svmClient, address, password);

  const start = Date.now();

  // Step 2: Send the transaction in the selected mode
  const signature =
    mode === "gasless"
      ? await sendTransactionGasless(svmClient, wallet, password, orderId)
      : await sendTransactionStandard(svmClient, wallet, password);

  // Step 3: Display results
  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.info(`\nTransaction sent in ${duration}s`);
  console.info(`Signature: ${signature}`);
  console.info(`Explorer: ${getSolanaTransactionLink(signature)}`);
  console.info(`Mode: ${mode}`);
  console.info(`Wallet: ${wallet.address}`);
});
