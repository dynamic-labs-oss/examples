#!/usr/bin/env tsx

/**
 * Dynamic Server Wallet Management
 *
 * Create and manage server-side wallets for automated operations like
 * omnibus payments, treasury management, and gasless transactions.
 *
 * ## Creating Wallets
 *
 * Create ephemeral wallets for one-time use:
 *   pnpm evm:wallet --create
 *
 * Create and save wallets for reuse (key shares stored locally):
 *   pnpm evm:wallet --create --save
 *
 * Create with key shares backed up to Dynamic (requires password to sign):
 *   pnpm evm:wallet --create --save --backup --password mySecretPassword
 *
 * ## Managing Saved Wallets
 *
 * List all saved wallets:
 *   pnpm evm:wallet --list
 *
 * Delete a saved wallet:
 *   pnpm evm:wallet --delete 0x123...
 *
 * ## Using Wallets
 *
 * Created wallets can be used with other examples:
 *
 * send-transaction.ts - Send transactions two ways:
 * - Standard transactions (wallet pays its own gas)
 * - Gasless transactions sponsored by Dynamic
 *
 * sign-message.ts - Sign messages for authentication and verification
 */

import { ThresholdSignatureScheme } from "@dynamic-labs-wallet/node";

import { parseArgs, runScript } from "../lib/cli";
import { authenticatedEvmClient } from "../lib/clients/evm";
import { deleteWallet, listWallets, saveWallet } from "../lib/wallet-storage";

const THRESHOLD_MAP: Record<string, ThresholdSignatureScheme> = {
  "2": ThresholdSignatureScheme.TWO_OF_TWO,
  "3": ThresholdSignatureScheme.TWO_OF_THREE,
};

async function createWallet(
  shouldSave: boolean,
  password?: string,
  backup: boolean = false,
  threshold: string = "2",
) {
  const scheme =
    THRESHOLD_MAP[threshold] ?? ThresholdSignatureScheme.TWO_OF_TWO;

  // Backing shares up to Dynamic encrypts them with the password, so the SDK
  // rejects the request upfront if one is missing.
  if (backup && !password) {
    console.error("--backup requires --password to encrypt the backup");
    console.error(
      "  pnpm evm:wallet --create --save --backup --password mySecretPassword",
    );
    process.exit(1);
  }

  // Step 1: Authenticate with Dynamic using your API token
  // This returns a client that can create and manage wallets
  const dynamicEvmClient = await authenticatedEvmClient();

  console.info(`Creating server wallet (${scheme})...`);
  const start = Date.now();

  // Step 2: Create a new server-side wallet
  // Returns: { walletMetadata, externalServerKeyShares, publicKeyHex, rawPublicKey }
  //
  // Parameters:
  // - thresholdSignatureScheme: Controls how many key shares are required to sign
  // - backUpToDynamic: When true, key shares are backed up to Dynamic and can be
  //   recovered with the password. When false, you must save them locally.
  // - password: Encrypts the key shares for backup recovery. Required when
  //   backUpToDynamic is true.
  const { walletMetadata, externalServerKeyShares } =
    await dynamicEvmClient.createWalletAccount({
      thresholdSignatureScheme: scheme,
      backUpToDynamic: backup,
      ...(password && { password }),
    });

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.info(`Server wallet created in ${duration}s`);
  console.info(`Address: ${walletMetadata.accountAddress}`);
  if (backup) console.info(`Key shares backed up to Dynamic`);
  if (password) console.info(`Password protection enabled`);

  if (shouldSave) {
    // Always persist walletMetadata — the SDK is stateless and needs it back on
    // every signing call. It cannot be reliably re-fetched later: lookups omit
    // the backup pointers that signing with caller-held shares requires.
    saveWallet({
      address: walletMetadata.accountAddress,
      walletMetadata,
      // When backed up, the shares are recovered via password at sign time.
      // Otherwise you MUST keep them — without them this address cannot sign.
      externalServerKeyShares: backup ? [] : externalServerKeyShares,
      createdAt: new Date().toISOString(),
    });
  } else {
    console.info(`Tip: Add '--save' flag to persist wallet for reuse`);
  }
}

/** EVM and SVM share `.wallets.json`, so filter to this chain's wallets. */
const CHAIN_NAME = "EVM";

function displayWalletList() {
  const wallets = listWallets(CHAIN_NAME);

  if (wallets.length === 0) {
    console.info("No saved wallets found");
    console.info("Tip: Use 'pnpm evm:wallet --create --save' to create a wallet");
    return;
  }

  console.info(`Saved wallets (${wallets.length}):\n`);
  wallets.forEach((w, i) => {
    console.info(`${i + 1}. ${w.address}`);
    console.info(
      `   Key shares: ${w.externalServerKeyShares.length > 0 ? "stored locally" : "backed up to Dynamic"}`,
    );
    console.info(`   Created: ${new Date(w.createdAt).toLocaleString()}`);
    console.info("");
  });
}

function removeWallet(address: string) {
  const success = deleteWallet(address);

  if (!success) {
    console.error(`Wallet not found: ${address}`);
    console.info(`Tip: Use 'pnpm evm:wallet --list' to see saved wallets`);
    process.exit(1);
  }

  console.info(`Wallet deleted successfully`);
}

function showUsage() {
  console.error("Please specify an action:");
  console.error(
    "  pnpm evm:wallet --create                                        # Create wallet (ephemeral)",
  );
  console.error(
    "  pnpm evm:wallet --create --save                                 # Create and save wallet (key shares stored locally)",
  );
  console.error(
    "  pnpm evm:wallet --create --save --threshold 3                   # Create with 2-of-3 threshold",
  );
  console.error(
    "  pnpm evm:wallet --create --save --backup --password xyz         # Create with key shares backed up to Dynamic",
  );
  console.error(
    "  pnpm evm:wallet --list                                          # List saved wallets",
  );
  console.error(
    "  pnpm evm:wallet --delete <address>                              # Delete a saved wallet",
  );
  process.exit(1);
}

runScript(async () => {
  const { hasFlag, getFlag } = parseArgs(process.argv);

  const shouldCreate = hasFlag("create");
  const shouldList = hasFlag("list");
  const shouldSave = hasFlag("save");
  const shouldDelete = hasFlag("delete");
  const shouldBackup = hasFlag("backup");
  const deleteAddress = getFlag("delete");
  const password = getFlag("password");
  const threshold = getFlag("threshold") ?? "2";

  if (!shouldCreate && !shouldList && !shouldDelete) {
    showUsage();
  }

  if (shouldDelete && !deleteAddress) {
    console.error("Please provide an address to delete");
    console.error("  pnpm evm:wallet --delete <address>");
    process.exit(1);
  }

  if (shouldList) {
    displayWalletList();
  } else if (shouldDelete && deleteAddress) {
    removeWallet(deleteAddress);
  } else if (shouldCreate) {
    await createWallet(shouldSave, password, shouldBackup, threshold);
  }
});
