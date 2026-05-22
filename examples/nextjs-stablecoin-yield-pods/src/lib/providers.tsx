"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  getWalletAccounts,
  onEvent,
  isSignedIn,
  logout,
  detectOAuthRedirect,
  completeSocialAuthentication,
  getActiveNetworkId,
} from "@dynamic-labs-sdk/client";
import { createWaasWalletAccounts } from "@dynamic-labs-sdk/client/waas";
import { isEvmWalletAccount, type EvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DynamicProvider, useUser, useWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
import { dynamicClient } from "./dynamic";

interface WalletContextValue {
  evmAccount: EvmWalletAccount | null;
  loggedIn: boolean;
  chainId: number;
  setChainId: (id: number) => void;
  ensureEvmWallet: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue>({
  evmAccount: null,
  loggedIn: false,
  chainId: 8453,
  setChainId: () => {},
  ensureEvmWallet: async () => {},
  disconnect: async () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

function InnerProviders({ children }: { children: ReactNode }) {
  const loggedIn = useUser() !== null;
  const evmAccount = useWalletAccounts().find(isEvmWalletAccount) ?? null;
  const [chainId, setChainId] = useState<number>(8453);

  useEffect(() => {
    if (!evmAccount) return;
    getActiveNetworkId({ walletAccount: evmAccount }, dynamicClient)
      .then(({ networkId }) => setChainId(Number(networkId)))
      .catch(() => {});
  }, [evmAccount]);

  const disconnect = useCallback(async () => {
    await logout(dynamicClient);
  }, []);

  const ensureEvmWallet = useCallback(async () => {
    try {
      const accounts = getWalletAccounts(dynamicClient);
      if (!accounts.some(isEvmWalletAccount) && isSignedIn(dynamicClient)) {
        await createWaasWalletAccounts({ chains: ["EVM"] }, dynamicClient);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const unsub = onEvent(
      {
        event: "walletAccountsChanged",
        listener: () => {
          void ensureEvmWallet();
        },
      },
      dynamicClient,
    );
    return () => unsub?.();
  }, [ensureEvmWallet]);

  useEffect(() => {
    const handleOAuthRedirect = async () => {
      if (typeof window === "undefined") return;
      try {
        const url = new URL(window.location.href);
        if (await detectOAuthRedirect({ url }, dynamicClient)) {
          await completeSocialAuthentication({ url }, dynamicClient);
          await ensureEvmWallet();
          window.history.replaceState({}, "", window.location.pathname);
        }
      } catch {}
    };
    handleOAuthRedirect();
  }, [ensureEvmWallet]);

  return (
    <WalletContext.Provider
      value={{
        evmAccount,
        loggedIn,
        chainId,
        setChainId,
        ensureEvmWallet,
        disconnect,
      }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WalletContext.Provider>
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <DynamicProvider client={dynamicClient}>
      <InnerProviders>{children}</InnerProviders>
    </DynamicProvider>
  );
}
