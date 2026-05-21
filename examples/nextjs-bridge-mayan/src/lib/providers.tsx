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
} from "@dynamic-labs-sdk/client";
import { createWaasWalletAccounts } from "@dynamic-labs-sdk/client/waas";
import {
  isEvmWalletAccount,
  type EvmWalletAccount,
} from "@dynamic-labs-sdk/evm";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { dynamicClient } from "./dynamic";

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
  const [evmAccount, setEvmAccount] = useState<EvmWalletAccount | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  const refresh = useCallback(() => {
    const accounts = getWalletAccounts(dynamicClient);
    setEvmAccount(accounts.find(isEvmWalletAccount) ?? null);
    setLoggedIn(isSignedIn(dynamicClient));
  }, []);

  const disconnect = useCallback(async () => {
    await logout(dynamicClient);
    setEvmAccount(null);
    setLoggedIn(false);
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
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleOAuthRedirect = async () => {
      if (typeof window === "undefined") return;
      try {
        const url = new URL(window.location.href);
        if (await detectOAuthRedirect({ url }, dynamicClient)) {
          await completeSocialAuthentication({ url }, dynamicClient);
          await ensureEvmWallet();
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
      } catch {
        // not an OAuth redirect — continue normally
      }
      refresh();
    };

    handleOAuthRedirect();

    const unsub1 = onEvent(
      { event: "walletAccountsChanged", listener: () => ensureEvmWallet() },
      dynamicClient
    );
    const unsub2 = onEvent(
      {
        event: "logout",
        listener: () => {
          setEvmAccount(null);
          setLoggedIn(false);
        },
      },
      dynamicClient
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [refresh, ensureEvmWallet]);

  return (
    <WalletContext.Provider value={{ evmAccount, loggedIn, ensureEvmWallet, disconnect }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WalletContext.Provider>
  );
}
