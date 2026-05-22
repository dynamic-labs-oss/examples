"use client";

/**
 * Networks
 *
 * Query and switch between blockchain networks configured in the
 * Dynamic dashboard.
 *
 * @see https://www.dynamic.xyz/docs/javascript/reference/wallets/get-active-network
 * @see https://www.dynamic.xyz/docs/javascript/reference/wallets/switch-active-network
 */

import {
  getNetworksData as sdkGetNetworksData,
  getActiveNetworkData as sdkGetActiveNetworkData,
  switchActiveNetwork as sdkSwitchActiveNetwork,
  type WalletAccount,
  type NetworkData,
} from "@dynamic-labs-sdk/client";
import { getClient, createSafeWrapper, createAsyncSafeWrapper } from "./client";

/**
 * Get all enabled networks from Dynamic dashboard config.
 * Returns empty array during SSR.
 */
export const getNetworksData = createSafeWrapper(sdkGetNetworksData, []);

/**
 * Get the active network for a wallet account.
 * Returns undefined networkData during SSR or on error.
 */
export async function getActiveNetworkData(params: {
  walletAccount: WalletAccount;
}): Promise<{ networkData: NetworkData | undefined }> {
  const client = getClient();
  if (!client) return { networkData: undefined };

  try {
    return await sdkGetActiveNetworkData(params);
  } catch {
    return { networkData: undefined };
  }
}

/**
 * Switch the active network for a wallet account.
 */
export const switchActiveNetwork = createAsyncSafeWrapper(
  sdkSwitchActiveNetwork,
);

export type { NetworkData };
