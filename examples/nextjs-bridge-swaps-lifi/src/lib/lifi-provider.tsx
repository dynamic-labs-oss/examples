"use client";

import { config as lifiConfig } from "@lifi/sdk";
import { useQuery } from "@tanstack/react-query";
import { type FC, type PropsWithChildren, useEffect, useState } from "react";
import { initializeLiFiConfig, loadLiFiChains } from "./lifi";
import { useWallet } from "./providers";

export const LiFiProvider: FC<PropsWithChildren> = ({ children }) => {
  const { evmAccount, loggedIn } = useWallet();
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
    enabled: loggedIn,
  });

  useEffect(() => {
    if (loggedIn && !isInitialized) {
      try {
        initializeLiFiConfig(() => evmAccount);
        setIsInitialized(true);
      } catch {
        setIsInitialized(false);
      }
    }
  }, [loggedIn, evmAccount, isInitialized]);

  // Re-initialize when the account changes so the wallet client getter is fresh
  useEffect(() => {
    if (isInitialized && evmAccount) {
      try {
        initializeLiFiConfig(() => evmAccount);
      } catch {
        // ignore
      }
    }
  }, [evmAccount, isInitialized]);

  if (chainsLoading || !loggedIn || !isInitialized) {
    return (
      <div className="flex justify-center items-center h-[100px] text-sm opacity-70">
        {!loggedIn
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

  void chains;
  return <>{children}</>;
};
