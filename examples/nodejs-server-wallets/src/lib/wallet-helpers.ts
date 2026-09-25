/**
 * Wallet Retrieval
 *
 * Chain-agnostic: both `DynamicEvmWalletClient` and `DynamicSvmWalletClient`
 * expose an identical `createWalletAccount`, so the EVM and SVM examples share
 * one implementation rather than duplicating it per chain.
 */

import {
  type ServerKeyShare,
  ThresholdSignatureScheme,
  type WalletMetadata,
} from "@dynamic-labs-wallet/node";

import { getWallet } from "./wallet-storage";

/** A wallet resolved from storage or freshly created, ready to sign. */
export interface WalletInfo {
  address: string;
  /** Required by every v1 signing call — the SDK holds no wallet state. */
  walletMetadata: WalletMetadata;
  externalServerKeyShares: ServerKeyShare[];
}

/**
 * The slice of `DynamicEvmWalletClient` / `DynamicSvmWalletClient` this helper
 * needs. Both expose an identical `createWalletAccount`, so the EVM and SVM
 * examples share one implementation rather than duplicating it per chain.
 */
export interface WalletCreatingClient {
  createWalletAccount(args: {
    thresholdSignatureScheme: ThresholdSignatureScheme;
    password?: string;
    backUpToDynamic?: boolean;
  }): Promise<{
    walletMetadata: WalletMetadata;
    externalServerKeyShares: ServerKeyShare[];
  }>;
}

/**
 * Get an existing wallet from storage or create a new ephemeral wallet
 *
 * @param client - Authenticated Dynamic wallet client (EVM or SVM)
 * @param addressArg - Optional wallet address to load from storage
 * @param password - Optional password for wallet creation or backup recovery
 * @returns Wallet metadata and key shares
 */
export async function getOrCreateWallet(
  client: WalletCreatingClient,
  addressArg?: string,
  password?: string,
): Promise<WalletInfo> {
  // If address provided, load from storage
  if (addressArg) {
    console.info(`Looking up wallet: ${addressArg}`);
    const stored = getWallet(addressArg);

    if (!stored) {
      console.error(`Wallet not found: ${addressArg}`);
      console.error(`Tip: Use the wallet script's --list flag to see saved wallets`);
      process.exit(1);
    }

    // If key shares are stored locally, use them directly
    if (stored.externalServerKeyShares.length > 0) {
      console.info(`Loaded wallet from storage`);
      return {
        address: stored.address,
        walletMetadata: stored.walletMetadata,
        externalServerKeyShares: stored.externalServerKeyShares,
      };
    }

    // Key shares were backed up to Dynamic — password required at sign time.
    // The SDK recovers the shares when they are omitted and a password is
    // supplied, using the backup pointers on the stored walletMetadata.
    if (!password) {
      console.error(
        `This wallet's key shares are backed up to Dynamic. Provide --password to recover them.`,
      );
      process.exit(1);
    }

    console.info(
      `Loaded wallet from storage (shares will be recovered from backup)`,
    );
    return {
      address: stored.address,
      walletMetadata: stored.walletMetadata,
      externalServerKeyShares: [],
    };
  }

  // Create new ephemeral wallet
  console.info(`Creating new wallet...`);
  const { walletMetadata, externalServerKeyShares } =
    await client.createWalletAccount({
      thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
      backUpToDynamic: false,
      ...(password && { password }),
    });

  console.info(`Wallet created: ${walletMetadata.accountAddress}`);

  return {
    address: walletMetadata.accountAddress,
    walletMetadata,
    externalServerKeyShares,
  };
}
