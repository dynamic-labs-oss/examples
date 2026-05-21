"use client";

import {
  ChainType,
  EVM,
  createConfig,
  getChains,
  getTokens,
  type ExtendedChain,
} from "@lifi/sdk";
import type { Token } from "@lifi/sdk";
import type { Client } from "viem";

export const initializeLiFiConfig = (
  getDynamicWalletClient: () => Promise<Client | null> | Client | null
) => {
  return createConfig({
    integrator: "dynamic-polymarket-demo",
    providers: [
      EVM({
        getWalletClient: async () => {
          const client = await getDynamicWalletClient();
          return client as Client;
        },
        switchChain: async (chainId) => {
          const client = await getDynamicWalletClient();
          if (
            client &&
            typeof (client as Record<string, unknown>).switchChain ===
              "function"
          ) {
            await (client as unknown as { switchChain: (args: { chainId: number }) => Promise<void> })
              .switchChain({ chainId });
          }
          return client as Client;
        },
      }),
    ],
    apiKey: process.env.NEXT_PUBLIC_LIFI_API_KEY,
  });
};

export const loadLiFiChains = async (): Promise<ExtendedChain[]> => {
  try {
    return await getChains({ chainTypes: [ChainType.EVM] });
  } catch (error) {
    console.error("Failed to load LI.FI chains:", error);
    return [];
  }
};

export const loadLiFiTokens = async (chainId: number): Promise<Token[]> => {
  try {
    const response = await getTokens({ chains: [chainId] });
    return response.tokens[chainId] || [];
  } catch (error) {
    console.error(`Failed to load tokens for chain ${chainId}:`, error);
    return [];
  }
};
