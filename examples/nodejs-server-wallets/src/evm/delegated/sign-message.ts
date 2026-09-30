#!/usr/bin/env tsx

/**
 * Delegated Wallet Message Signing Demo
 *
 * Sign messages using a delegated wallet for authentication and verification.
 *
 * ## Prerequisites
 *
 * This script requires a wallet.json file with delegated access credentials.
 * See wallet.json.example for the required format.
 *
 * The delegated share is obtained through a separate process where the user
 * grants your application permission to sign on their behalf.
 *
 * ## Usage
 *
 *   pnpm evm:delegated:sign-msg "Hello, World!"
 *
 * ## Use Cases
 *
 * - Authenticate users by proving wallet ownership
 * - Sign authorization tokens or session data
 * - Verify identity without on-chain transactions
 * - Create off-chain signatures for gasless flows
 */

import { parseArgs, runScript } from "../../lib/cli";
import { delegatedEvmClient, delegatedSignMessage } from "../../lib/clients/evm";
import { loadEvmDelegatedCredentials } from "./credentials";

/**
 * Step 1: Sign a message with delegated credentials
 *
 * Unlike server wallets where you control the key shares,
 * delegated wallets use credentials provided by the wallet owner.
 */
async function signMessage(message: string) {
  // Create delegated client
  const client = delegatedEvmClient();
  const credentials = loadEvmDelegatedCredentials();

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
  console.info(`Signature: ${signature}`);

  return signature;
}

runScript(async () => {
  const { positional } = parseArgs(process.argv);
  const message = positional[0];

  if (!message) {
    console.error("Please provide a message to sign");
    console.error("\nUsage:");
    console.error('  pnpm evm:delegated:sign-msg "Hello, World!"');
    process.exit(1);
  }

  await signMessage(message);
});
