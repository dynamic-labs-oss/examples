#!/usr/bin/env tsx

/**
 * Delegated Solana Wallet Message Signing Demo
 *
 * Sign messages using a delegated Solana wallet for authentication and
 * verification. No gas sponsorship involved — this is entirely off-chain.
 *
 * ## Prerequisites
 *
 * Requires src/svm/delegated/wallet.json with delegated credentials for a
 * **Solana** wallet. See wallet.json.example for the format.
 *
 * ## Usage
 *
 *   pnpm svm:delegated:sign-msg "Hello, World!"
 *
 * ## Use Cases
 *
 * - Authenticate users by proving wallet ownership
 * - Sign authorization tokens or session data
 * - Verify identity without on-chain transactions
 */

import { parseArgs, runScript } from "../../lib/cli";
import { delegatedSvmClient, delegatedSignMessage } from "../../lib/clients/svm";
import { loadSvmDelegatedCredentials } from "./credentials";

/**
 * Step 1: Sign a message with delegated credentials
 *
 * Unlike server wallets where you control the key shares,
 * delegated wallets use credentials provided by the wallet owner.
 */
async function signMessage(message: string) {
  const client = delegatedSvmClient();
  const credentials = loadSvmDelegatedCredentials();

  console.info(`\nSigning message...`);
  const start = Date.now();

  // Sign using the wallet owner's delegated share
  const signature = await delegatedSignMessage(client, {
    walletId: credentials.walletId,
    walletApiKey: credentials.walletApiKey,
    keyShare: credentials.keyShare,
    ...(credentials.shareSetId && { shareSetId: credentials.shareSetId }),
    message,
  });

  // Step 2: Display results
  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.info(`\nMessage signed in ${duration}s`);
  console.info(`Message: "${message}"`);
  console.info(`Signature (base58): ${signature}`);
  console.info(`Signer: ${credentials.address}`);

  return signature;
}

runScript(async () => {
  const { positional } = parseArgs(process.argv);
  const message = positional[0];

  if (!message) {
    console.error("Please provide a message to sign");
    console.error("\nUsage:");
    console.error('  pnpm svm:delegated:sign-msg "Hello, World!"');
    process.exit(1);
  }

  await signMessage(message);
});
