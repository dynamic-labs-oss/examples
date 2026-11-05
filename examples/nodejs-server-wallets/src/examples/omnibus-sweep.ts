#!/usr/bin/env tsx

/**
 * Dynamic Gasless Transaction Demo - Omnibus Sweep
 *
 * Demonstrates how to create and manage multiple server-side wallets
 * with gasless transactions for financial applications.
 *
 * ## What This Demo Does
 *
 * 1. Creates an omnibus wallet for fund aggregation
 * 2. Creates multiple customer wallets (default: 10)
 * 3. Funds each customer wallet with random USDC amounts
 * 4. Sweeps all funds to the omnibus wallet using gasless transactions
 * 5. Processes transactions concurrently for scalability
 *
 * Gas is sponsored by Dynamic, so customer wallets never need a native token
 * balance — which is what makes a per-customer wallet model practical at all.
 *
 * ## Usage
 *
 * Run with default settings (10 wallets):
 *   pnpm example:omnibus
 *
 * Run with custom number of wallets:
 *   pnpm example:omnibus 20
 *
 * ## Use Case
 *
 * This pattern is ideal for financial institutions that need to:
 * - Manage individual customer wallets
 * - Aggregate funds to centralized omnibus accounts
 * - Execute transactions without customers holding ETH for gas
 * - Process operations at scale with concurrent transactions
 *
 * ## Requirements
 *
 * EVM Gas Sponsorship is an enterprise feature and must be enabled under
 * Settings -> Embedded Wallets in the Dynamic dashboard. Set RPC_URL to a
 * dedicated provider before running this — the public endpoint will rate limit
 * the concurrent delegation checks.
 */

import { randomInt } from "node:crypto";

import {
  type ServerKeyShare,
  ThresholdSignatureScheme,
  type WalletMetadata,
} from "@dynamic-labs-wallet/node";
import type { DynamicEvmWalletClient } from "@dynamic-labs-wallet/node-evm";
import pLimit from "p-limit";
import { encodeFunctionData, type Hex, parseUnits } from "viem";

import { CONTRACTS, DEFAULT_CHAIN, TOKEN_ABI, USDC_DECIMALS } from "../../constants";
import { parseArgs, runScript } from "../lib/cli";
import { authenticatedEvmClient } from "../lib/clients/evm";
import { sendSponsoredTransaction } from "../lib/gasless/evm";
import {
  formatAddress,
  getAddressLink,
  getTransactionLink,
} from "../lib/utils";

interface DynamicWalletAccount {
  walletMetadata: WalletMetadata;
  externalServerKeyShares: ServerKeyShare[];
}

interface CustomerWallet {
  index: number;
  wallet: DynamicWalletAccount;
  usdcAmount: bigint;
}

const USDC_ADDRESS = CONTRACTS[DEFAULT_CHAIN.id].USDC;

// ---- Demo tuning. Only this demo uses these, so they live here. -------------

const DEFAULT_NUM_WALLETS = 10;

/** Max test USDC minted per customer wallet. */
const MAX_USDC_AMOUNT = 1000;

/** Concurrency caps, to stay inside Dynamic's API rate limits. */
const WALLET_CREATION_LIMIT = pLimit(5);
const TRANSACTION_LIMIT = pLimit(25);

let dynamicEvmClient: DynamicEvmWalletClient;

/**
 * Creates a new Dynamic wallet account with retry logic and timeout handling.
 * Uses 2-of-2 threshold signatures for enhanced security.
 *
 * Note: This function includes retry logic specific to the omnibus demo.
 * For simpler wallet creation, see src/evm/wallet.ts or lib/wallet-helpers.ts
 */
async function createWalletAccount(
  walletNumber: number,
): Promise<DynamicWalletAccount | null> {
  if (!dynamicEvmClient) dynamicEvmClient = await authenticatedEvmClient();

  // Create timeout promise to prevent hanging
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(new Error(`Wallet creation timeout for wallet ${walletNumber}`)),
      60000, // 60 second timeout
    ),
  );

  // Create wallet with retry logic and exponential backoff
  const createWallet = async (): Promise<DynamicWalletAccount | null> => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const { walletMetadata, externalServerKeyShares } =
          await dynamicEvmClient.createWalletAccount({
            thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
            backUpToDynamic: false,
          });

        // The SDK is stateless — hold onto both of these or the wallet cannot sign
        return { walletMetadata, externalServerKeyShares };
      } catch (_error) {
        if (attempt === 5) break; // Don't delay after last attempt

        const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
        console.error(
          `Retrying to create wallet account ${walletNumber}. Attempt ${attempt}/5 in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.info(
      `Failed to create wallet account ${walletNumber} after 5 retries. Skipping...`,
    );
    return null;
  };

  try {
    return await Promise.race([createWallet(), timeoutPromise]);
  } catch (error) {
    console.error(
      `Wallet creation timed out for wallet ${walletNumber}:`,
      error,
    );
    return null;
  }
}

/**
 * Sends a gasless transaction from a customer wallet and returns its hash.
 *
 * Dynamic sponsors the gas and its relayer submits the transaction. Note this
 * resolves at relay status `submitted` — *before* mining — so the hash means
 * "delivered", not "executed". This demo never reads post-transaction state, so it
 * skips the receipt wait; anything that does must confirm the receipt first
 * (see IDEMPOTENCY.md).
 */
async function sendSponsoredCall({
  wallet,
  to,
  data,
}: {
  wallet: DynamicWalletAccount;
  to: Hex;
  data: Hex;
}): Promise<Hex> {
  const { transactionHash } = await sendSponsoredTransaction({
    evmClient: dynamicEvmClient,
    walletMetadata: wallet.walletMetadata,
    externalServerKeyShares: wallet.externalServerKeyShares,
    calls: [{ target: to, data, value: 0n }],
  });

  return transactionHash;
}

/**
 * Creates a customer wallet and assigns it a random USDC amount (1-1000).
 */
async function createCustomerWallet(
  index: number,
): Promise<CustomerWallet | null> {
  const walletNumber = index + 1;
  const customerWallet = await createWalletAccount(index);
  if (!customerWallet) return null;

  console.info(
    `Customer wallet ${walletNumber} created: ${customerWallet.walletMetadata.accountAddress}`,
  );

  // Generate random USDC amount up to MAX_USDC_AMOUNT
  const usdcAmount = BigInt(randomInt(1, MAX_USDC_AMOUNT + 1));

  return {
    index: walletNumber,
    wallet: customerWallet,
    usdcAmount,
  };
}

/**
 * Funds a customer wallet by minting USDC tokens.
 * In production, this would be replaced with actual token transfers.
 */
async function fundCustomerWallet(
  customerWallet: CustomerWallet,
): Promise<void> {
  // Mint USDC to customer wallet
  const txHash = await sendSponsoredCall({
    wallet: customerWallet.wallet,
    to: USDC_ADDRESS,
    data: encodeFunctionData({
      abi: TOKEN_ABI,
      functionName: "mint",
      args: [customerWallet.usdcAmount],
    }),
  });
  console.info(
    `Funded customer wallet ${customerWallet.index} (${formatAddress(
      customerWallet.wallet.walletMetadata.accountAddress,
    )}): ${customerWallet.usdcAmount} USDC - ${getTransactionLink(txHash)}`,
  );
}

/**
 * Transfers USDC from a customer wallet to the omnibus account.
 * This is the core "sweep" operation that aggregates funds.
 */
async function sweepToOmnibus(
  customerWallet: CustomerWallet,
  omnibus: Hex,
): Promise<bigint> {
  const tokenUnits = parseUnits(String(customerWallet.usdcAmount), USDC_DECIMALS);

  // Transfer USDC from customer wallet to omnibus account
  const txHash = await sendSponsoredCall({
    wallet: customerWallet.wallet,
    to: USDC_ADDRESS,
    data: encodeFunctionData({
      abi: TOKEN_ABI,
      functionName: "transfer",
      args: [omnibus, tokenUnits],
    }),
  });
  console.info(
    `Swept customer wallet ${customerWallet.index} (${formatAddress(
      customerWallet.wallet.walletMetadata.accountAddress,
    )}): ${customerWallet.usdcAmount} USDC to omnibus - ${getTransactionLink(
      txHash,
    )}`,
  );

  return customerWallet.usdcAmount;
}

runScript(async () => {
  const { positional } = parseArgs(process.argv);

  // Parse number of wallets from command line
  const numWalletsArg = positional[0];
  const NUM_WALLETS = numWalletsArg
    ? parseInt(numWalletsArg, 10)
    : DEFAULT_NUM_WALLETS;

  // Validate inputs
  if (Number.isNaN(NUM_WALLETS) || NUM_WALLETS <= 0) {
    console.error(
      "Error: Please provide a positive integer for the number of customer wallets to create",
    );
    console.error("Usage: pnpm example:omnibus [num_wallets]");
    console.error("Example: pnpm example:omnibus 10");
    process.exit(1);
  }

  console.info("Dynamic Gasless Transaction Demo - Omnibus Sweep");
  console.info(
    "Demonstrating scalable wallet management and gasless transfers",
  );
  console.info("=".repeat(60));
  console.info(
    `Configuration: ${NUM_WALLETS} wallets, funding random USDC amounts up to ${MAX_USDC_AMOUNT}`,
  );
  console.info("=".repeat(60));

  // Initialize the DynamicEvmWalletClient
  dynamicEvmClient = await authenticatedEvmClient();

  console.info("Creating omnibus wallet for fund aggregation...");
  const omnibusWallet = await createWalletAccount(0);
  if (!omnibusWallet) process.exit(1);

  const omnibusAddress = omnibusWallet.walletMetadata.accountAddress as Hex;
  const omnibusAddressFormatted = formatAddress(omnibusAddress);
  console.info(`Omnibus wallet created: ${omnibusAddressFormatted}`);
  console.info("");

  console.info(`Creating ${NUM_WALLETS} customer wallets...`);
  const walletCreationPromises = Array.from(
    { length: NUM_WALLETS },
    (_, index) => WALLET_CREATION_LIMIT(() => createCustomerWallet(index)),
  );

  const customerWallets = await Promise.all(walletCreationPromises);
  const createdWallets = customerWallets.filter(
    (wallet): wallet is CustomerWallet => wallet !== null,
  );
  const failedWallets = customerWallets.filter(
    (wallet) => wallet === null,
  ).length;

  console.info(
    `Successfully created ${createdWallets.length} out of ${NUM_WALLETS} wallets (${failedWallets} failed)`,
  );
  console.info("");

  console.info(
    `Funding ${createdWallets.length} customer wallets with USDC tokens...`,
  );
  const fundingPromises = createdWallets.map((customerWallet) =>
    TRANSACTION_LIMIT(() => fundCustomerWallet(customerWallet)),
  );
  await Promise.all(fundingPromises);
  console.info("");

  console.info(
    `Sweeping funds from ${createdWallets.length} customer wallets to omnibus account...`,
  );
  const sweepPromises = createdWallets.map((customerWallet) =>
    TRANSACTION_LIMIT(() => sweepToOmnibus(customerWallet, omnibusAddress)),
  );

  const usdcAmounts = await Promise.all(sweepPromises);

  const totalSwept = usdcAmounts.reduce((sum, amount) => sum + amount, 0n);

  console.info("");
  console.info("=".repeat(60));
  console.info(`Demo completed successfully.`);
  console.info(`Total USDC transferred: ${totalSwept} USDC`);
  console.info(
    `Omnibus wallet address: ${omnibusAddressFormatted} - ${getAddressLink(
      omnibusAddress,
    )}#tokentxns`,
  );
});
