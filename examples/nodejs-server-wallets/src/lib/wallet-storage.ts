/**
 * Wallet Storage Utilities
 *
 * ⚠️ WARNING: FOR TESTING AND DEVELOPMENT ONLY - NOT FOR PRODUCTION USE
 *
 * This file provides simple file-based storage for wallet key shares.
 * It is intended ONLY for local development and testing purposes.
 *
 * DO NOT USE IN PRODUCTION because:
 * - Key shares are stored unencrypted in a local JSON file
 * - No access control or security measures are implemented
 * - File permissions are not managed
 * - No backup or recovery mechanisms
 *
 * For production environments, you should:
 * - Use a secure key management service (AWS KMS, HashiCorp Vault, etc.)
 * - Encrypt key shares at rest
 * - Implement proper access controls and audit logging
 * - Use a secure database with encryption
 * - Follow your organization's security best practices
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ServerKeyShare, WalletMetadata } from "@dynamic-labs-wallet/node";

// Local file storage - FOR TESTING ONLY
const WALLET_FILE = join(process.cwd(), ".wallets.json");

/** One persisted wallet: identity, metadata, and (optionally) its key shares. */
export interface StoredWallet {
  address: string;
  /**
   * The full `walletMetadata` returned at creation. The SDK is stateless, so
   * every sign / export / backup call needs this back — and it must be the
   * object from `createWalletAccount`, not one re-fetched later.
   * `fetchWalletMetadata` omits `externalServerKeySharesBackupInfo`, which
   * signing with caller-held shares requires, so it is not a recovery path.
   *
   * Store and pass it whole. Trimming to the type-required fields fails at
   * runtime — the type is inaccurate both ways (README, "Persisting Wallets").
   *
   * Non-sensitive: safe alongside normal application data.
   */
  walletMetadata: WalletMetadata;
  /**
   * Sensitive MPC key shares. Empty when backed up to Dynamic instead.
   * In production these belong in a vault (KMS, Vault), never on disk.
   */
  externalServerKeyShares: ServerKeyShare[];
  createdAt: string;
}

interface WalletStorage {
  [address: string]: StoredWallet;
}

/** Read the whole store. Internal — callers use the accessors below. */
function loadWallets(): WalletStorage {
  if (!existsSync(WALLET_FILE)) return {};

  try {
    const data = readFileSync(WALLET_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.warn("Failed to load wallets file:", error);
    return {};
  }
}

/**
 * Save a wallet to local storage
 * ⚠️ FOR TESTING ONLY - Use secure storage in production
 */
export function saveWallet(wallet: StoredWallet): void {
  const wallets = loadWallets();
  wallets[wallet.address] = wallet;

  writeFileSync(WALLET_FILE, JSON.stringify(wallets, null, 2));
  console.info(`Wallet saved to ${WALLET_FILE}`);
}

/**
 * Get a specific wallet by address
 * ⚠️ FOR TESTING ONLY - Use secure storage in production
 */
export function getWallet(address: string): StoredWallet | undefined {
  const wallets = loadWallets();
  return wallets[address];
}

/**
 * List saved wallets, optionally narrowed to one chain.
 *
 * EVM and SVM wallets share this store, so each chain's wallet script filters
 * on `walletMetadata.chainName` to avoid listing the other chain's addresses.
 *
 * ⚠️ FOR TESTING ONLY - Use secure storage in production
 */
export function listWallets(chainName?: string): StoredWallet[] {
  const wallets = Object.values(loadWallets());

  if (!chainName) return wallets;
  return wallets.filter((w) => w.walletMetadata?.chainName === chainName);
}

/**
 * Delete a wallet from local storage
 * ⚠️ FOR TESTING ONLY - Use secure storage in production
 */
export function deleteWallet(address: string): boolean {
  const wallets = loadWallets();

  if (!wallets[address]) return false;

  delete wallets[address];
  writeFileSync(WALLET_FILE, JSON.stringify(wallets, null, 2));
  console.info(`Wallet ${address} deleted`);
  return true;
}
