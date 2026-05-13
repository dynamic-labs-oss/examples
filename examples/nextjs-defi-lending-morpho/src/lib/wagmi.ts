import { createConfig, http } from "wagmi";
import { base, mainnet, arbitrum, optimism, polygon } from "wagmi/chains";
import { SUPPORTED_CHAIN_IDS } from "./networks";

export const config = createConfig({
  chains: [base, mainnet, arbitrum, optimism, polygon],
  multiInjectedProviderDiscovery: false,
  ssr: true,
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
