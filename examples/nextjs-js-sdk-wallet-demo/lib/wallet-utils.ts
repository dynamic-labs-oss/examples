/**
 * Wallet Utilities
 *
 * Helper functions for working with Dynamic wallet accounts.
 *
 * Key concepts:
 * - Each address may have multiple wallet accounts (base WaaS + ZeroDev wrapper)
 * - Base wallet: The underlying WaaS wallet (dynamicWaas provider)
 * - ZeroDev wallet: Smart contract wallet wrapper for gas sponsorship
 *
 * The useGasSponsorship hook handles wallet selection for transactions.
 * These utilities are for display and network operations.
 */

import type { WalletAccount } from "@dynamic-labs-sdk/client";

/**
 * Find the base (non-ZeroDev) wallet for an address
 *
 * Use this for:
 * - Network switching (ZeroDev follows the base wallet's network)
 * - Displaying active network status
 * - Operations that need the underlying WaaS wallet
 */
export function getBaseWalletForAddress(
  address: string,
  walletAccounts: WalletAccount[],
): WalletAccount | undefined {
  const walletsForAddress = walletAccounts.filter(
    (w) => w.address.toLowerCase() === address.toLowerCase(),
  );

  // Prefer the base wallet (non-ZeroDev)
  const baseWallet = walletsForAddress.find(
    (w) => !w.walletProviderKey.includes("zerodev"),
  );

  return baseWallet || walletsForAddress[0];
}

/**
 * Wallet info for display (deduped by address)
 */
export interface UniqueWalletInfo {
  /** Wallet address */
  address: string;
  /** Chain type (EVM, SOL) */
  chain: string;
  /** Whether a ZeroDev wallet exists for this address */
  hasZeroDev: boolean;
  /** The wallet account to use for operations */
  walletAccount: WalletAccount;
}

/**
 * Get unique wallet addresses for display
 *
 * Deduplicates dynamicWaas vs ZeroDev wallets that share the same address.
 * Use this for the wallet list UI to avoid showing duplicates.
 */
export function getUniqueWalletAddresses(
  walletAccounts: WalletAccount[],
): UniqueWalletInfo[] {
  const map = new Map<string, UniqueWalletInfo>();

  for (const wallet of walletAccounts) {
    const addressLower = wallet.address.toLowerCase();
    const hasZeroDev = wallet.walletProviderKey.includes("zerodev");
    const existing = map.get(addressLower);

    if (!existing) {
      map.set(addressLower, {
        address: wallet.address,
        chain: wallet.chain,
        hasZeroDev,
        walletAccount: wallet,
      });
    } else if (hasZeroDev) {
      existing.hasZeroDev = true;
    }
  }

  return Array.from(map.values());
}
