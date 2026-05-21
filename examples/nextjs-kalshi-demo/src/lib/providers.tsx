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
  isSolanaWalletAccount,
  type SolanaWalletAccount,
} from "@dynamic-labs-sdk/solana";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { dynamicClient } from "./dynamic";
import { ToastProvider } from "@/components/ui/Toast";

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

export default function Providers({ children }: { children: ReactNode }) {
  const [solanaAccount, setSolanaAccount] = useState<SolanaWalletAccount | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  const refresh = useCallback(() => {
    const accounts = getWalletAccounts(dynamicClient);
    setSolanaAccount(accounts.find(isSolanaWalletAccount) ?? null);
    setLoggedIn(isSignedIn(dynamicClient));
  }, []);

  const disconnect = useCallback(async () => {
    await logout(dynamicClient);
    setSolanaAccount(null);
    setLoggedIn(false);
  }, []);

  const ensureSolanaWallet = useCallback(async () => {
    try {
      const accounts = getWalletAccounts(dynamicClient);
      if (!accounts.some(isSolanaWalletAccount) && isSignedIn(dynamicClient)) {
        await createWaasWalletAccounts({ chains: ["SOL"] }, dynamicClient);
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
          await ensureSolanaWallet();
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
      { event: "walletAccountsChanged", listener: () => ensureSolanaWallet() },
      dynamicClient
    );
    const unsub2 = onEvent(
      {
        event: "logout",
        listener: () => {
          setSolanaAccount(null);
          setLoggedIn(false);
        },
      },
      dynamicClient
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [refresh, ensureSolanaWallet]);

  return (
    <WalletContext.Provider
      value={{ solanaAccount, loggedIn, ensureSolanaWallet, disconnect }}
    >
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </QueryClientProvider>
    </WalletContext.Provider>
  );
}
