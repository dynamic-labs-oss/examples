"use client";

import { config as lifiConfig } from "@lifi/sdk";
import { useSyncWagmiConfig } from "@lifi/wallet-management";
import { useQuery } from "@tanstack/react-query";
import { type FC, type PropsWithChildren, useEffect, useState } from "react";
import type { Config, CreateConnectorFn } from "wagmi";
import { initializeLiFiConfig, loadLiFiChains } from "./lifi";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";

type LiFiConfigParam = Parameters<typeof initializeLiFiConfig>[0];
type SyncConfigParam = Parameters<typeof useSyncWagmiConfig>[0];

interface LiFiProviderProps extends PropsWithChildren {
  wagmiConfig: Config;
  connectors: CreateConnectorFn[];
}

export const LiFiProvider: FC<LiFiProviderProps> = ({
  children,
  wagmiConfig,
  connectors,
}) => {
  const { sdkHasLoaded } = useDynamicContext();
  const [isInitialized, setIsInitialized] = useState(false);

  const {
    data: chains,
    error: chainsError,
    isLoading: chainsLoading,
  } = useQuery({
    queryKey: ["lifi-chains"] as const,
    queryFn: async () => {
      const chains = await loadLiFiChains();

      if (chains.length > 0) {
        lifiConfig.setChains(chains);
      }
      return chains;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 3,
    retryDelay: 1000,
    enabled: sdkHasLoaded,
  });

  useEffect(() => {
    if (sdkHasLoaded && !isInitialized) {
      try {
        initializeLiFiConfig(wagmiConfig as unknown as LiFiConfigParam);
        setIsInitialized(true);
      } catch {
        setIsInitialized(false);
      }
    }
  }, [sdkHasLoaded, wagmiConfig, isInitialized]);

  useSyncWagmiConfig(
    wagmiConfig as unknown as SyncConfigParam,
    connectors,
    chains
  );

  if (chainsLoading || !sdkHasLoaded || !isInitialized) {
    return (
      <div className="flex justify-center items-center h-[100px] text-sm opacity-70">
        {!sdkHasLoaded
          ? "Loading Dynamic SDK..."
          : chainsLoading
          ? "Loading LiFi chains..."
          : "Initializing LiFi..."}
      </div>
    );
  }

  if (chainsError) {
    return (
      <div className="flex justify-center items-center h-[100px] text-sm text-red-500">
        Failed to load LiFi chains. Please refresh the page.
      </div>
    );
  }

  return <>{children}</>;
};
