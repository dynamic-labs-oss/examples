import { ChainType, EVM, createConfig, getChains } from "@lifi/sdk";
import { getWalletClient, switchChain } from "@wagmi/core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const initializeLiFiConfig = (wagmiConfig: any) => {
  return createConfig({
    integrator: "Dynamic",
    providers: [
      EVM({
        getWalletClient: () => getWalletClient(wagmiConfig),
        switchChain: async (chainId: number) => {
          const chain = await switchChain(wagmiConfig, { chainId });
          return getWalletClient(wagmiConfig, { chainId: chain.id });
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
