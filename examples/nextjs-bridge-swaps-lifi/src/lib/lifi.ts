import { ChainType, EVM, createConfig, getChains } from "@lifi/sdk";
import type { EvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWalletClient = any;

export const initializeLiFiConfig = (getEvmAccount: () => EvmWalletAccount | null) => {
  return createConfig({
    integrator: "Dynamic",
    providers: [
      EVM({
        getWalletClient: async (): Promise<AnyWalletClient> => {
          const account = getEvmAccount();
          if (!account) throw new Error("No EVM wallet connected");
          return createWalletClientForWalletAccount({ walletAccount: account });
        },
        switchChain: async (_chainId: number): Promise<AnyWalletClient> => {
          // Chain switching is handled per-transaction by the embedded wallet
          const account = getEvmAccount();
          if (!account) throw new Error("No EVM wallet connected");
          return createWalletClientForWalletAccount({ walletAccount: account });
        },
      }),
    ],
    apiKey: process.env.NEXT_PUBLIC_LIFI_API_KEY,
  });
};

export const loadLiFiChains = async () => {
  try {
    const chains = await getChains({
      chainTypes: [ChainType.EVM],
    });
    return chains;
  } catch {
    return [];
  }
};
