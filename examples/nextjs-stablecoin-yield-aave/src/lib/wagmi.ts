import { http, createConfig } from "wagmi";
import { mainnet, base } from "wagmi/chains";

export const config = createConfig({
  // make sure to update the chains in the dashboard
  chains: [mainnet, base],
  multiInjectedProviderDiscovery: false,
  ssr: true,
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
