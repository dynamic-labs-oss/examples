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
import type { Wallet } from "@dynamic-labs/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { dynamicClient } from "./dynamic";
import { useAuth } from "@/hooks/use-auth";
import { useSolanaWalletAccount } from "@/hooks/use-wallet-accounts";

interface WalletContextValue {
  solanaAccount: Wallet | null;
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
  const loggedIn = useAuth();
  const solanaAccount = useSolanaWalletAccount();

  const disconnect = useCallback(async () => {
    await logout(dynamicClient);
  }, []);

  // After a successful login (email OTP, Google, or external wallet), ensure
  // the user has a Solana embedded wallet. Silently ignores errors (e.g. wallet
  // already exists or WaaS not enabled for this environment).
  const ensureSolanaWallet = useCallback(async () => {
    try {
      const accounts = getWalletAccounts(dynamicClient);
      const hasSolana = accounts.some((w) => w.chain === "SOL");
      if (!hasSolana && isSignedIn(dynamicClient)) {
        await createWaasWalletAccounts({ chains: ["SOL"] }, dynamicClient);
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
          void ensureSolanaWallet();
        },
      },
      dynamicClient,
    );
    return () => unsub?.();
  }, [ensureSolanaWallet]);

  // Handle OAuth redirect (Google sign-in callback)
  useEffect(() => {
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
        }
      } catch {
        // not an OAuth redirect — continue normally
      }
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
