#!/usr/bin/env tsx

/**
 * Delegated Solana Wallet Gasless Transaction Demo
 *
 * Send a gasless Solana transaction from a wallet a user has delegated to your
 * app, with the fee sponsored by Dynamic.
 *
 * ## How this differs from a server wallet
 *
 * With a server wallet you hold the key shares, so `signTransaction` can sign
 * the sponsored transaction directly.
 *
 * A delegated wallet's share stays with Dynamic behind a wallet-scoped API key,
 * so the two steps are split:
 *
 *   1. `sponsorTransaction()` on the API-token client swaps the fee payer for
 *      Dynamic's sponsor and signs as it. No wallet key material involved.
 *   2. `delegatedSignTransaction()` signs the sponsored transaction with the
 *      user's delegated share, passing `signerAddress` so it signs as the
 *      *instruction* signer rather than the fee payer (which is now the sponsor).
 *
 * Order matters: swapping the fee payer changes the message, so sponsorship has
 * to come first or the user's signature covers a stale message.
 *
 * ## Why not a custom fee payer?
 *
 * Dynamic's docs also describe holding your own funded Solana keypair and
 * signing as fee payer alongside the user. This example deliberately doesn't:
 * letting Dynamic be the fee payer means no raw private key in your environment.
 *
 * ## Prerequisites
 *
 * Requires src/svm/delegated/wallet.json with delegated credentials for a
 * **Solana** wallet. See wallet.json.example for the format.
 *
 * Gas sponsorship must be enabled for your environment in the Dynamic dashboard.
 *
 * ## Usage
 *
 *   pnpm svm:delegated:send-txn
 */

import { runScript } from "../../lib/cli";
import { delegatedSvmClient } from "../../lib/clients/svm";
import { sendDelegatedSponsoredTransaction } from "../../lib/gasless/svm";
import { buildDemoTransfer } from "../transaction";
import { getSolanaTransactionLink } from "../../lib/utils";
import { loadSvmDelegatedCredentials } from "./credentials";

/**
 * Step 1: Build the delegated client and send the sponsored transaction
 *
 * One client does both halves: `sponsor: true` has Dynamic swap in its own fee
 * payer, and the user's delegated credentials sign the result.
 */
async function sendTransaction() {
  const delegatedClient = delegatedSvmClient();

  // Credentials come from your delegation webhook
  const credentials = loadSvmDelegatedCredentials();

  console.info(`\nSending gasless transaction (sponsored by Dynamic)...`);
  console.info(`Wallet: ${credentials.address}`);
  const start = Date.now();

  // A 0-lamport self-transfer: moves no value, but still requires the user's
  // signature, which is what demonstrates that they authorized it while Dynamic
  // paid for it.
  const transaction = await buildDemoTransfer({
    senderAddress: credentials.address,
  });

  // Step 2: Sponsor + sign with the delegated credentials, then broadcast
  const signature = await sendDelegatedSponsoredTransaction({
    delegatedClient,
    credentials,
    transaction,
  });

  // Step 3: Display results
  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.info(`\nTransaction sent in ${duration}s`);
  console.info(`Signature: ${signature}`);
  console.info(`Explorer: ${getSolanaTransactionLink(signature)}`);

  return signature;
}

runScript(async () => {
  await sendTransaction();
});
