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
  const [solanaAccount, setSolanaAccount] =
    useState<SolanaWalletAccount | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  const refresh = useCallback(() => {
    const accounts = getWalletAccounts(dynamicClient);
    const solana = accounts.find(isSolanaWalletAccount) ?? null;
    setSolanaAccount(solana);
    setLoggedIn(isSignedIn(dynamicClient));
  }, []);

  const disconnect = useCallback(async () => {
    await logout(dynamicClient);
    setSolanaAccount(null);
    setLoggedIn(false);
  }, []);

  // After a successful login (email OTP, Google, or external wallet), ensure
  // the user has a Solana embedded wallet. Silently ignores errors (e.g. wallet
  // already exists or WaaS not enabled for this environment).
  const ensureSolanaWallet = useCallback(async () => {
    try {
      const accounts = getWalletAccounts(dynamicClient);
      const hasSolana = accounts.some(isSolanaWalletAccount);
      if (!hasSolana && isSignedIn(dynamicClient)) {
        await createWaasWalletAccounts({ chains: ["SOL"] }, dynamicClient);
      }
    } catch {
      // wallet may already exist — ignore
    }
    refresh();
  }, [refresh]);

  useEffect(() => {
    // Handle OAuth redirect (Google sign-in callback)
    const handleOAuthRedirect = async () => {
      if (typeof window === "undefined") return;
      try {
        const url = new URL(window.location.href);
        const isOAuth = await detectOAuthRedirect({ url }, dynamicClient);
        if (isOAuth) {
          await completeSocialAuthentication({ url }, dynamicClient);
          await ensureSolanaWallet();
          // Clean up OAuth query params from URL
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
      } catch {
        // not an OAuth redirect — continue normally
      }
      refresh();
    };

    handleOAuthRedirect();

    const unsubWallets = onEvent(
      {
        event: "walletAccountsChanged",
        listener: () => ensureSolanaWallet(),
      },
      dynamicClient
    );

    const unsubLogout = onEvent(
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
      unsubWallets();
      unsubLogout();
    };
  }, [refresh, ensureSolanaWallet]);

  return (
    <WalletContext.Provider
      value={{ solanaAccount, loggedIn, ensureSolanaWallet, disconnect }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WalletContext.Provider>
  );
}
