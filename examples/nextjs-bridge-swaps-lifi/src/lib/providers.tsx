"use client";

import { LiFiProvider } from "@/lib/lifi-provider";
import { config } from "@/lib/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import type { CreateConnectorFn } from "wagmi";
import { ThemeProvider } from "@/components/theme-provider";
import {
  DynamicContextProvider,
  EthereumWalletConnectors,
  ZeroDevSmartWalletConnectors,
  DynamicWagmiConnector,
} from "@/lib/dynamic";

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient();
  const connectors: CreateConnectorFn[] = [];

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <DynamicContextProvider
        theme="auto"
        settings={{
          environmentId:
            process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID ||
            "ff782f0d-1d05-4aeb-b978-7fb59d9c36da",
          walletConnectors: [
            EthereumWalletConnectors,
            ZeroDevSmartWalletConnectors,
          ],
        }}
      >
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <DynamicWagmiConnector>
              <LiFiProvider wagmiConfig={config} connectors={connectors}>
                {children}
              </LiFiProvider>
            </DynamicWagmiConnector>
          </QueryClientProvider>
        </WagmiProvider>
      </DynamicContextProvider>
    </ThemeProvider>
  );
}
