"use client";

import { config } from "@/lib/wagmi";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { GlobalWalletExtension } from "@dynamic-labs/global-wallet";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { ThemeProvider } from "@/components/theme-provider";

// Create a single QueryClient instance outside the component
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
    >
      <DynamicContextProvider
        theme="light"
        settings={{
          environmentId:
            // replace with your own environment ID
            process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID ||
            "9405948e-3dc1-4402-86c1-7b8e7f88542d",
          walletConnectors: [EthereumWalletConnectors],
          walletConnectorExtensions: [GlobalWalletExtension],
          overrides: {
            evmNetworks: [
              {
                chainId: 8453,
                chainName: "Base",
                name: "Base",
                blockExplorerUrls: ["https://basescan.org/"],
                iconUrls: ["https://app.dynamic.xyz/assets/networks/base.svg"],
                nativeCurrency: {
                  decimals: 18,
                  name: "Ether",
                  symbol: "ETH",
                },
                networkId: 8453,
                rpcUrls: ["https://mainnet.base.org"],
              },
              {
                chainId: 1,
                chainName: "Ethereum Mainnet",
                name: "Ethereum",
                blockExplorerUrls: ["https://etherscan.io/"],
                iconUrls: ["https://app.dynamic.xyz/assets/networks/eth.svg"],
                nativeCurrency: {
                  decimals: 18,
                  name: "Ether",
                  symbol: "ETH",
                },
                networkId: 1,
                rpcUrls: ["https://mainnet.infura.io/v3/"],
              },
              {
                chainId: 42161,
                chainName: "Arbitrum One",
                name: "Arbitrum",
                blockExplorerUrls: ["https://arbiscan.io/"],
                iconUrls: [
                  "https://app.dynamic.xyz/assets/networks/arbitrum.svg",
                ],
                nativeCurrency: {
                  decimals: 18,
                  name: "Ether",
                  symbol: "ETH",
                },
                networkId: 42161,
                rpcUrls: ["https://arb1.arbitrum.io/rpc"],
              },
              {
                chainId: 10,
                chainName: "Optimism",
                name: "Optimism",
                blockExplorerUrls: ["https://optimistic.etherscan.io/"],
                iconUrls: [
                  "https://app.dynamic.xyz/assets/networks/optimism.svg",
                ],
                nativeCurrency: {
                  decimals: 18,
                  name: "Ether",
                  symbol: "ETH",
                },
                networkId: 10,
                rpcUrls: ["https://mainnet.optimism.io"],
              },
              {
                chainId: 137,
                chainName: "Polygon",
                name: "Polygon",
                blockExplorerUrls: ["https://polygonscan.com/"],
                iconUrls: [
                  "https://app.dynamic.xyz/assets/networks/polygon.svg",
                ],
                nativeCurrency: {
                  decimals: 18,
                  name: "MATIC",
                  symbol: "MATIC",
                },
                networkId: 137,
                rpcUrls: ["https://polygon-rpc.com"],
              },
            ],
          },
        }}
      >
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <DynamicWagmiConnector>{children}</DynamicWagmiConnector>
          </QueryClientProvider>
        </WagmiProvider>
      </DynamicContextProvider>
    </ThemeProvider>
  );
}
