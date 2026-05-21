"use client";

import { config as lifiConfig } from "@lifi/sdk";
import { useQuery } from "@tanstack/react-query";
import { type FC, type PropsWithChildren, useEffect, useCallback, useRef } from "react";
import { initializeLiFiConfig, loadLiFiChains } from "./lifi";
import { useWallet } from "./providers";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { polygon } from "viem/chains";

export const LiFiProvider: FC<PropsWithChildren> = ({ children }) => {
  const { evmAccount, loggedIn } = useWallet();
  const initRef = useRef(false);
  const evmAccountRef = useRef(evmAccount);
  useEffect(() => {
    evmAccountRef.current = evmAccount;
  }, [evmAccount]);

  const { data: chains } = useQuery({
    queryKey: ["lifi-chains"],
    queryFn: async () => {
      const chains = await loadLiFiChains();
      if (chains.length > 0) lifiConfig.setChains(chains);
      return chains;
    },
    staleTime: 5 * 60 * 1000,
    retry: 3,
    enabled: loggedIn,
  });

  const getDynamicWalletClient = useCallback(async () => {
    const account = evmAccountRef.current;
    if (!account) return null;
    return await createWalletClientForWalletAccount({ walletAccount: account });
  }, []);

  useEffect(() => {
    if (loggedIn && !initRef.current && chains?.length) {
      try {
        initializeLiFiConfig(getDynamicWalletClient);
        initRef.current = true;
      } catch (error) {
        console.error("Failed to initialize LI.FI:", error);
      }
    }
  }, [loggedIn, getDynamicWalletClient, chains]);

  return <>{children}</>;
};
