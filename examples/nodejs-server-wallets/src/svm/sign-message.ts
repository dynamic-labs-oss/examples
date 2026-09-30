#!/usr/bin/env tsx

/**
 * Dynamic Solana Message Signing Demo
 *
 * Sign messages with Dynamic Solana server wallets for authentication,
 * verification, and proof of ownership.
 *
 * Signatures are Ed25519 and returned base58-encoded, which is the Solana
 * convention — unlike the hex signatures on the EVM side.
 *
 * ## Usage
 *
 *   pnpm svm:sign-msg "Hello, World!"                                  # New ephemeral wallet
 *   pnpm svm:sign-msg "Hello, World!" --address <addr>                 # Saved wallet
 *   pnpm svm:sign-msg "Hello, World!" --address <addr> --password xyz  # Password-protected
 *
 * ## Use Cases
 *
 * - Authenticate users by proving wallet ownership
 * - Sign authorization tokens or session data
 * - Verify identity without on-chain transactions
 */

import { parseArgs, runScript } from "../lib/cli";
import { authenticatedSvmClient, type SvmClient } from "../lib/clients/svm";
import { getOrCreateWallet, type WalletInfo } from "../lib/wallet-helpers";

/**
 * Step 2: Sign a message with the wallet
 */
async function signMessage(
  svmClient: SvmClient,
  message: string,
  wallet: WalletInfo,
  password?: string,
) {
  console.info(`\nSigning message...`);
  const start = Date.now();

  // Pass walletMetadata whole — trimming it to the type-required fields fails at
  // runtime (see README, "Persisting Wallets"). Shares: pass when you hold them,
  // omit when backed up to Dynamic so the SDK recovers them with the password.
  const signature = await svmClient.signMessage({
    walletMetadata: wallet.walletMetadata,
    ...(wallet.externalServerKeyShares.length > 0 && {
      externalServerKeyShares: wallet.externalServerKeyShares,
    }),
    message,
    ...(password && { password }),
  });

  const duration = ((Date.now() - start) / 1000).toFixed(2);

  // Step 3: Display results
  console.info(`\nMessage signed in ${duration}s`);
  console.info(`Message: "${message}"`);
  console.info(`Signature (base58): ${signature}`);
  console.info(`Signer: ${wallet.address}`);

  return signature;
}

function showUsage(): never {
  console.error("Please provide a message to sign");
  console.error("\nUsage:");
  console.error('  pnpm svm:sign-msg "Hello, World!"');
  console.error('  pnpm svm:sign-msg "Hello, World!" --address <addr>');
  console.error(
    '  pnpm svm:sign-msg "Hello, World!" --address <addr> --password xyz',
  );
  process.exit(1);
}

runScript(async () => {
  const { positional, getFlag } = parseArgs(process.argv);

  const message = positional[0];
  const address = getFlag("address");
  const password = getFlag("password");

  if (!message) {
    showUsage();
  }

  // Step 1: Get or create wallet
  const svmClient = await authenticatedSvmClient();
  const wallet = await getOrCreateWallet(svmClient, address, password);

  // Step 2: Sign the message
  await signMessage(svmClient, message, wallet, password);
});
