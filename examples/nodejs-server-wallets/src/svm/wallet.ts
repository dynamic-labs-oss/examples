#!/usr/bin/env tsx

/**
 * Dynamic Solana Server Wallet Management
 *
 * Create and manage server-side Solana wallets. Mirrors the EVM wallet script;
 * only the client differs.
 *
 * ## Creating Wallets
 *
 * Create ephemeral wallets for one-time use:
 *   pnpm svm:wallet --create
 *
 * Create and save wallets for reuse (key shares stored locally):
 *   pnpm svm:wallet --create --save
 *
 * Create with key shares backed up to Dynamic (requires password to sign):
 *   pnpm svm:wallet --create --save --backup --password mySecretPassword
 *
 * ## Managing Saved Wallets
 *
 * List saved Solana wallets:
 *   pnpm svm:wallet --list
 *
 * Delete a saved wallet:
 *   pnpm svm:wallet --delete <address>
 *
 * ## Using Wallets
 *
 * send-transaction.ts - Send SOL transfers, standard or gasless
 * sign-message.ts     - Sign messages for authentication and verification
 */

import { ThresholdSignatureScheme } from "@dynamic-labs-wallet/node";

import { parseArgs, runScript } from "../lib/cli";
import { authenticatedSvmClient, getLamportBalance } from "../lib/clients/svm";

import { getSolanaAddressLink } from "../lib/utils";
import { deleteWallet, listWallets, saveWallet } from "../lib/wallet-storage";

const THRESHOLD_MAP: Record<string, ThresholdSignatureScheme> = {
  "2": ThresholdSignatureScheme.TWO_OF_TWO,
  "3": ThresholdSignatureScheme.TWO_OF_THREE,
};

/** Solana wallets are stored alongside EVM ones, so listings filter on this. */
const CHAIN_NAME = "SVM";

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
      "  pnpm svm:wallet --create --save --backup --password mySecretPassword",
    );
    process.exit(1);
  }

  // Step 1: Authenticate with Dynamic using your API token
  const svmClient = await authenticatedSvmClient();

  console.info(`Creating Solana server wallet (${scheme})...`);
  const start = Date.now();

  // Step 2: Create the wallet. Same call shape as the EVM client — the SDK is
  // stateless, so persist walletMetadata and the key shares yourself.
  const { walletMetadata, externalServerKeyShares } =
    await svmClient.createWalletAccount({
      thresholdSignatureScheme: scheme,
      backUpToDynamic: backup,
      ...(password && { password }),
    });

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.info(`Solana server wallet created in ${duration}s`);
  console.info(`Address: ${walletMetadata.accountAddress}`);
  console.info(`Explorer: ${getSolanaAddressLink(walletMetadata.accountAddress)}`);
  if (backup) console.info(`Key shares backed up to Dynamic`);
  if (password) console.info(`Password protection enabled`);

  if (shouldSave) {
    saveWallet({
      address: walletMetadata.accountAddress,
      walletMetadata,
      externalServerKeyShares: backup ? [] : externalServerKeyShares,
      createdAt: new Date().toISOString(),
    });
  } else {
    console.info(`Tip: Add '--save' flag to persist wallet for reuse`);
  }

  console.info(
    `\nNote: gasless sends need no balance. For 'svm:send-txn standard',`,
  );
  console.info(`fund this address with devnet SOL first.`);
}

async function displayWalletList() {
  const wallets = listWallets(CHAIN_NAME);

  if (wallets.length === 0) {
    console.info("No saved Solana wallets found");
    console.info(
      "Tip: Use 'pnpm svm:wallet --create --save' to create a wallet",
    );
    return;
  }

  console.info(`Saved Solana wallets (${wallets.length}):\n`);

  for (const [index, wallet] of wallets.entries()) {
    console.info(`${index + 1}. ${wallet.address}`);
    console.info(
      `   Key shares: ${
        wallet.externalServerKeyShares.length > 0
          ? "stored locally"
          : "backed up to Dynamic"
      }`,
    );
    console.info(`   Created: ${new Date(wallet.createdAt).toLocaleString()}`);

    // Balance only matters for non-sponsored sends, but it's the first thing
    // you want to know when a standard transfer fails.
    try {
      const lamports = await getLamportBalance(wallet.address);
      console.info(`   Balance: ${lamports / 1e9} SOL`);
    } catch {
      console.info(`   Balance: unavailable (RPC error)`);
    }

    console.info("");
  }
}

function removeWallet(address: string) {
  const success = deleteWallet(address);

  if (!success) {
    console.error(`Wallet not found: ${address}`);
    console.info(`Tip: Use 'pnpm svm:wallet --list' to see saved wallets`);
    process.exit(1);
  }

  console.info(`Wallet deleted successfully`);
}

function showUsage() {
  console.error("Please specify an action:");
  console.error(
    "  pnpm svm:wallet --create                                     # Create wallet (ephemeral)",
  );
  console.error(
    "  pnpm svm:wallet --create --save                              # Create and save wallet",
  );
  console.error(
    "  pnpm svm:wallet --create --save --threshold 3                # Create with 2-of-3 threshold",
  );
  console.error(
    "  pnpm svm:wallet --create --save --backup --password xyz      # Back shares up to Dynamic",
  );
  console.error(
    "  pnpm svm:wallet --list                                       # List saved Solana wallets",
  );
  console.error(
    "  pnpm svm:wallet --delete <address>                           # Delete a saved wallet",
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
    console.error("  pnpm svm:wallet --delete <address>");
    process.exit(1);
  }

  if (shouldList) {
    await displayWalletList();
  } else if (shouldDelete && deleteAddress) {
    removeWallet(deleteAddress);
  } else if (shouldCreate) {
    await createWallet(shouldSave, password, shouldBackup, threshold);
  }
});
