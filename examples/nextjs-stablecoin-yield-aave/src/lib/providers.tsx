"use client";

import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { ZeroDevSmartWalletConnectors } from "@dynamic-labs/ethereum-aa";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/wagmi";
import { AaveProvider } from "@aave/react";
import { client } from "./aave";
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
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <DynamicContextProvider
        theme="light"
        settings={{
          environmentId:
            // replace with your own environment ID
            process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID ||
            "9405948e-3dc1-4402-86c1-7b8e7f88542d",
          walletConnectors: [
            EthereumWalletConnectors,
            ZeroDevSmartWalletConnectors,
          ],
          overrides: {
            evmNetworks: [
              {
                chainId: 8453,
                chainName: "Base",
                name: "Base",
                blockExplorerUrls: ["https://basescan.org/"],
                iconUrls: ["https://app.dynamic.xyz/assets/networks/base.svg"],
                nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
                networkId: 8453,
                rpcUrls: ["https://mainnet.base.org"],
              },
              {
                chainId: 1,
                chainName: "Ethereum Mainnet",
                name: "Ethereum",
                blockExplorerUrls: ["https://etherscan.io/"],
                iconUrls: ["https://app.dynamic.xyz/assets/networks/eth.svg"],
                nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
                networkId: 1,
                rpcUrls: ["https://mainnet.infura.io/v3/"],
              },
            ],
          },
        }}
      >
        <WagmiProvider config={config}>
          <AaveProvider client={client}>
            <QueryClientProvider client={queryClient}>
              <DynamicWagmiConnector>{children}</DynamicWagmiConnector>
            </QueryClientProvider>
          </AaveProvider>
        </WagmiProvider>
      </DynamicContextProvider>
    </ThemeProvider>
  );
}
