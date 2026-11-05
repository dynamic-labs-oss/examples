#!/usr/bin/env tsx

/**
 * Dynamic Transaction Demo
 *
 * Send transactions from a server wallet, with or without gas sponsorship.
 *
 * ## Usage
 *
 *   pnpm evm:send-txn standard                                # Create new wallet, wallet pays gas
 *   pnpm evm:send-txn gasless                                 # Create new wallet, Dynamic sponsors gas
 *   pnpm evm:send-txn gasless --address 0x123...              # Use saved wallet
 *   pnpm evm:send-txn gasless --address 0x123... --password   # Use password-protected wallet
 *   pnpm evm:send-txn gasless --order-id order-1              # Idempotent: safe to retry
 *
 * ## Modes
 *
 * - **standard**: The wallet pays its own gas, so it needs a native token balance.
 * - **gasless**: Dynamic sponsors the gas. The wallet signs an EIP-712 intent and
 *   Dynamic's relayer submits it, so the wallet never needs a balance.
 *
 * Gasless keeps the wallet's own address as the sender — there is no smart
 * account wrapper, so both modes transact from the same address.
 *
 * ## Requirements for gasless
 *
 * EVM Gas Sponsorship is an enterprise feature and must be enabled under
 * Settings -> Embedded Wallets in the Dynamic dashboard.
 */

import { zeroAddress } from "viem";

import { DEFAULT_CHAIN, evmRpcUrl } from "../../constants";
import { parseArgs, runScript } from "../lib/cli";
import { authenticatedEvmClient, type EvmClient } from "../lib/clients/evm";
import {
  deriveIdempotencyNonce,
  sendSponsoredTransaction,
} from "../lib/gasless/evm";
import { getTransactionLink } from "../lib/utils";
import { getOrCreateWallet, type WalletInfo } from "../lib/wallet-helpers";

type GasMode = "standard" | "gasless";
const VALID_MODES: GasMode[] = ["standard", "gasless"];

/**
 * Step 2a: Send a standard transaction (the wallet pays its own gas)
 */
async function sendTransactionStandard(
  dynamicEvmClient: EvmClient,
  wallet: WalletInfo,
  password?: string,
) {
  // Create Dynamic client and get wallet client directly from SDK

  const walletClient = await dynamicEvmClient.getWalletClient({
    walletMetadata: wallet.walletMetadata,
    ...(wallet.externalServerKeyShares.length > 0 && {
      externalServerKeyShares: wallet.externalServerKeyShares,
    }),
    chain: DEFAULT_CHAIN,
    rpcUrl: evmRpcUrl(),
    password,
  });

  console.info(`Sending standard transaction (wallet pays gas)...`);
  const hash = await walletClient.sendTransaction({
    to: zeroAddress,
    value: 0n,
  });

  return hash;
}

/**
 * Step 2b: Send a gasless transaction sponsored by Dynamic
 *
 * Pass an `orderId` to make the send idempotent: the intent nonce is derived from
 * it, so retrying with the same value can never execute twice. Without one the
 * SDK generates a random nonce per call and a retry would double-execute.
 */
async function sendTransactionGasless(
  dynamicEvmClient: EvmClient,
  wallet: WalletInfo,
  password?: string,
  orderId?: string,
) {
  console.info(`Sending gasless transaction (sponsored by Dynamic)...`);
  if (orderId) {
    console.info(`Idempotent: nonce derived from "${orderId}"`);
  }

  // A sponsored transaction is a batch of calls rather than a single `to`/`value`.
  // On the wallet's first sponsored transaction the SDK also signs the one-time
  // EIP-7702 delegation, which is why this can take a little longer.
  const { transactionHash } = await sendSponsoredTransaction({
    evmClient: dynamicEvmClient,
    walletMetadata: wallet.walletMetadata,
    externalServerKeyShares: wallet.externalServerKeyShares,
    password,
    calls: [{ target: zeroAddress, data: "0x", value: 0n }],
    ...(orderId && { nonce: deriveIdempotencyNonce(orderId) }),
  });

  return transactionHash;
}

runScript(async () => {
  const { positional, getFlag } = parseArgs(process.argv);

  // Parse arguments
  const mode = (positional[0] || "standard") as GasMode;
  const address = getFlag("address");
  const password = getFlag("password");
  const orderId = getFlag("order-id");

  // Validate mode
  if (!VALID_MODES.includes(mode)) {
    console.error(`Invalid mode: ${mode}`);
    console.error(`Valid modes: ${VALID_MODES.join(", ")}`);
    process.exit(1);
  }

  // Step 1: Get or create wallet
  const dynamicEvmClient = await authenticatedEvmClient();
  const wallet = await getOrCreateWallet(dynamicEvmClient, address, password);

  const start = Date.now();

  // Step 2: Send the transaction in the selected mode
  const hash =
    mode === "gasless"
      ? await sendTransactionGasless(dynamicEvmClient, wallet, password, orderId)
      : await sendTransactionStandard(dynamicEvmClient, wallet, password);

  // Step 3: Display results
  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.info(`\nTransaction sent in ${duration}s`);
  console.info(`Hash: ${hash}`);
  console.info(`Explorer: ${getTransactionLink(hash)}`);
  console.info(`Mode: ${mode}`);
  console.info(`Wallet: ${wallet.address}`);
});
