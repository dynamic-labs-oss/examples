"use client";

import { config as lifiConfig } from "@lifi/sdk";
import { useQuery } from "@tanstack/react-query";
import {
  useEffect,
  useCallback,
  useRef,
  type FC,
  type PropsWithChildren,
} from "react";
import { initializeLiFiConfig, loadLiFiChains } from "./lifi";
import { useWallet } from "./providers";
import { signTransaction, getSolanaConnection } from "@dynamic-labs-sdk/solana";
import { getActiveNetworkData } from "@dynamic-labs-sdk/client";
import { dynamicClient } from "./dynamic";
import { PublicKey } from "@solana/web3.js";

export const LiFiProvider: FC<PropsWithChildren> = ({ children }) => {
  const { solanaAccount, loggedIn } = useWallet();
  const initRef = useRef(false);
  const solanaAccountRef = useRef(solanaAccount);
  useEffect(() => {
    solanaAccountRef.current = solanaAccount;
  }, [solanaAccount]);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getWalletAdapter = useCallback(async (): Promise<any> => {
    const account = solanaAccountRef.current;
    if (!account) return null;

    const { networkData } = await getActiveNetworkData({ walletAccount: account }, dynamicClient);
    const connection = networkData
      ? getSolanaConnection({ networkData })
      : null;

    return {
      publicKey: new PublicKey(account.address),
      signTransaction: async (tx: Parameters<typeof signTransaction>[0]["transaction"]) => {
        const { signedTransaction } = await signTransaction(
          { walletAccount: account, transaction: tx },
          dynamicClient
        );
        return signedTransaction;
      },
      signAllTransactions: async (txs: Parameters<typeof signTransaction>[0]["transaction"][]) => {
        const signed = [];
        for (const tx of txs) {
          const { signedTransaction } = await signTransaction(
            { walletAccount: account, transaction: tx },
            dynamicClient
          );
          signed.push(signedTransaction);
        }
        return signed;
      },
      connection,
    };
  }, []);

  useEffect(() => {
    if (loggedIn && !initRef.current && chains?.length) {
      try {
        initializeLiFiConfig(getWalletAdapter);
        initRef.current = true;
      } catch (error) {
        console.error("Failed to initialize LI.FI:", error);
      }
    }
  }, [loggedIn, getWalletAdapter, chains]);

  return <>{children}</>;
};
