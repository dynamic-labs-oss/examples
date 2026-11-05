#!/usr/bin/env tsx

/**
 * Dynamic EIP-712 Typed Data Signing Demo
 *
 * Sign structured data (EIP-712) with Dynamic server wallets.
 * Typed data signing is used for off-chain signatures that can be
 * verified on-chain, commonly used in permit signatures, meta-transactions,
 * and gasless approvals.
 *
 * ## Usage
 *
 *   pnpm evm:sign-typed-data                                    # Sign with new ephemeral wallet
 *   pnpm evm:sign-typed-data --address 0x123...                 # Sign with saved wallet
 *   pnpm evm:sign-typed-data --address 0x123... --password xyz  # Sign with password-protected wallet
 *
 * ## Use Cases
 *
 * - ERC-20 permit signatures (gasless approvals)
 * - Meta-transactions and gasless flows
 * - Off-chain order signing (DEXs, NFT marketplaces)
 * - Structured message verification
 */

import type { TypedData } from "viem";

import { parseArgs, runScript } from "../lib/cli";
import { authenticatedEvmClient, type EvmClient } from "../lib/clients/evm";
import { getOrCreateWallet, type WalletInfo } from "../lib/wallet-helpers";

// Example EIP-712 typed data for demonstration
// This follows the EIP-712 specification for structured data hashing and signing
const EXAMPLE_TYPED_DATA = {
  types: {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
    ],
    Mail: [
      { name: "from", type: "string" },
      { name: "to", type: "string" },
      { name: "contents", type: "string" },
    ],
  },
  primaryType: "Mail" as const,
  domain: {
    name: "Dynamic Example",
    version: "1",
    chainId: 84532, // Base Sepolia
  },
  message: {
    from: "Alice",
    to: "Bob",
    contents: "Hello from Dynamic!",
  },
};

/**
 * Step 2: Sign typed data with the wallet
 */
async function signTypedData(
  dynamicEvmClient: EvmClient,
  wallet: WalletInfo,
  password?: string,
) {
  console.info(`\nSigning EIP-712 typed data...`);
  const start = Date.now();

  const signature = await dynamicEvmClient.signTypedData({
    walletMetadata: wallet.walletMetadata,
    ...(wallet.externalServerKeyShares.length > 0 && {
      externalServerKeyShares: wallet.externalServerKeyShares,
    }),
    typedData: EXAMPLE_TYPED_DATA as unknown as TypedData,
    ...(password && { password }),
  });

  const duration = ((Date.now() - start) / 1000).toFixed(2);

  // Step 3: Display results
  console.info(`\nTyped data signed in ${duration}s`);
  console.info(`Domain: ${EXAMPLE_TYPED_DATA.domain.name}`);
  console.info(`Primary type: ${EXAMPLE_TYPED_DATA.primaryType}`);
  console.info(`Signature: ${signature}`);
  console.info(`Signer: ${wallet.address}`);

  return signature;
}

runScript(async () => {
  const { getFlag } = parseArgs(process.argv);

  const address = getFlag("address");
  const password = getFlag("password");

  // Step 1: Get or create wallet
  const dynamicEvmClient = await authenticatedEvmClient();
  const wallet = await getOrCreateWallet(dynamicEvmClient, address, password);

  // Step 2: Sign the typed data
  await signTypedData(dynamicEvmClient, wallet, password);
});
