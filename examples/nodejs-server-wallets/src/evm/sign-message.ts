#!/usr/bin/env tsx

/**
 * Dynamic Message Signing Demo
 *
 * Sign messages with Dynamic server wallets for authentication,
 * verification, and proof of ownership.
 *
 * ## Usage
 *
 *   pnpm evm:sign-msg "Hello, World!"                                    # Sign with new ephemeral wallet
 *   pnpm evm:sign-msg "Hello, World!" --address 0x123...                 # Sign with saved wallet
 *   pnpm evm:sign-msg "Hello, World!" --address 0x123... --password xyz  # Sign with password-protected wallet
 *
 * ## Use Cases
 *
 * - Authenticate users by proving wallet ownership
 * - Sign authorization tokens or session data
 * - Verify identity without on-chain transactions
 * - Create off-chain signatures for gasless flows
 */

import { parseArgs, runScript } from "../lib/cli";
import { authenticatedEvmClient, type EvmClient } from "../lib/clients/evm";
import { getOrCreateWallet, type WalletInfo } from "../lib/wallet-helpers";

/**
 * Step 2: Sign a message with the wallet
 */
async function signMessage(
  dynamicEvmClient: EvmClient,
  message: string,
  wallet: WalletInfo,
  password?: string,
) {
  console.info(`\nSigning message...`);
  const start = Date.now();

  // Pass walletMetadata whole — trimming it to the type-required fields fails at
  // runtime (see README, "Persisting Wallets"). Shares: pass when you hold them,
  // omit when backed up to Dynamic so the SDK recovers them with the password.
  const signature = await dynamicEvmClient.signMessage({
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
  console.info(`Signature: ${signature}`);
  console.info(`Signer: ${wallet.address}`);

  return signature;
}

function showUsage(): never {
  console.error("Please provide a message to sign");
  console.error("\nUsage:");
  console.error('  pnpm evm:sign-msg "Hello, World!"');
  console.error('  pnpm evm:sign-msg "Hello, World!" --address 0x123...');
  console.error(
    '  pnpm evm:sign-msg "Hello, World!" --address 0x123... --password xyz',
  );
  process.exit(1);
}

runScript(async () => {
  const { positional, getFlag } = parseArgs(process.argv);

  // Parse arguments
  const message = positional[0];
  const address = getFlag("address");
  const password = getFlag("password");

  if (!message) {
    showUsage();
  }

  // Step 1: Get or create wallet
  const dynamicEvmClient = await authenticatedEvmClient();
  const wallet = await getOrCreateWallet(dynamicEvmClient, address, password);

  // Step 2: Sign the message
  await signMessage(dynamicEvmClient, message, wallet, password);
});
