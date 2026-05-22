"use client";

/**
 * Wallet Provider Data
 *
 * Get metadata about wallet providers (e.g., icons, names).
 *
 * @see https://www.dynamic.xyz/docs/javascript/reference/wallets
 */

import { getWalletProviderDataByKey as sdkGetWalletProviderDataByKey } from "@dynamic-labs-sdk/client";
import { getClient } from "./client";

/**
 * Get wallet provider metadata by key.
 * Returns null during SSR or on error.
 */
export async function getWalletProviderDataByKey(params: {
  walletProviderKey: string;
}) {
  const client = getClient();
  if (!client) return null;

  try {
    return sdkGetWalletProviderDataByKey(params);
  } catch {
    return null;
  }
}
