"use client";

import {
  createContext,
  useContext,
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
} from "@dynamic-labs-sdk/client";
import { createWaasWalletAccounts } from "@dynamic-labs-sdk/client/waas";
import {
  isSolanaWalletAccount,
  type SolanaWalletAccount,
} from "@dynamic-labs-sdk/solana";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DynamicProvider, useUser, useWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
import { dynamicClient } from "./dynamic";

interface WalletContextValue {
  solanaAccount: SolanaWalletAccount | null;
  loggedIn: boolean;
  ensureSolanaWallet: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue>({
  solanaAccount: null,
  loggedIn: false,
  ensureSolanaWallet: async () => {},
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
  const solanaAccount = useWalletAccounts().find(isSolanaWalletAccount) ?? null;

  const disconnect = useCallback(async () => {
    await logout(dynamicClient);
  }, []);

  const ensureSolanaWallet = useCallback(async () => {
    try {
      const accounts = getWalletAccounts(dynamicClient);
      if (!accounts.some(isSolanaWalletAccount) && isSignedIn(dynamicClient)) {
        await createWaasWalletAccounts({ chains: ["SOL"] }, dynamicClient);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const unsub = onEvent(
      {
        event: "walletAccountsChanged",
        listener: () => {
          void ensureSolanaWallet();
        },
      },
      dynamicClient,
    );
    return () => unsub?.();
  }, [ensureSolanaWallet]);

  useEffect(() => {
    const handleOAuthRedirect = async () => {
      if (typeof window === "undefined") return;
      try {
        const url = new URL(window.location.href);
        if (await detectOAuthRedirect({ url }, dynamicClient)) {
          await completeSocialAuthentication({ url }, dynamicClient);
          await ensureSolanaWallet();
          window.history.replaceState({}, "", window.location.pathname);
        }
      } catch {}
    };
    handleOAuthRedirect();
  }, [ensureSolanaWallet]);

  return (
    <WalletContext.Provider
      value={{ solanaAccount, loggedIn, ensureSolanaWallet, disconnect }}
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
