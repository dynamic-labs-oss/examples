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
import { isEvmWalletAccount, type EvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { dynamicClient } from "./dynamic";
import { useAuth } from "@/hooks/use-auth";
import { useEvmWalletAccount } from "@/hooks/use-wallet-accounts";

interface WalletContextValue {
  evmAccount: EvmWalletAccount | null;
  loggedIn: boolean;
  ensureEvmWallet: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue>({
  evmAccount: null,
  loggedIn: false,
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

export default function Providers({ children }: { children: ReactNode }) {
  const loggedIn = useAuth();
  const evmAccount = useEvmWalletAccount();

  const disconnect = useCallback(async () => {
    await logout(dynamicClient);
  }, []);

  const ensureEvmWallet = useCallback(async () => {
    try {
      const accounts = getWalletAccounts(dynamicClient);
      if (!accounts.some(isEvmWalletAccount) && isSignedIn(dynamicClient)) {
        await createWaasWalletAccounts({ chains: ["EVM"] }, dynamicClient);
      }
    } catch {
      // wallet may already exist — ignore
    }
  }, []);

  // Auto-create wallet when accounts change (side effect, not state)
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

  // Handle OAuth redirect on mount
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
      } catch {
        // not an OAuth redirect — continue normally
      }
    };
    handleOAuthRedirect();
  }, [ensureEvmWallet]);

  return (
    <WalletContext.Provider value={{ evmAccount, loggedIn, ensureEvmWallet, disconnect }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WalletContext.Provider>
  );
}
