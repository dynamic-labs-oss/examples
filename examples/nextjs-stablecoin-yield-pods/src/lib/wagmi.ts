import { http, createConfig } from "wagmi";
import { mainnet, base, polygon } from "wagmi/chains";

export const config = createConfig({
  // make sure to update the chains in the dashboard
  chains: [mainnet, base, polygon],
  multiInjectedProviderDiscovery: false,
  ssr: true,
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
