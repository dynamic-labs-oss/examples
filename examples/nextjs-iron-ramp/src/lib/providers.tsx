"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { logout, detectOAuthRedirect, completeSocialAuthentication } from "@dynamic-labs/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useReactiveClient } from "@dynamic-labs/react-hooks";
import type { Wallet } from "@dynamic-labs/client";
import { dynamicClient } from "./dynamic";

interface WalletContextValue {
  evmAccount: Wallet | null;
  solanaAccount: Wallet | null;
  loggedIn: boolean;
  ensureWallets: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue>({
  evmAccount: null,
  solanaAccount: null,
  loggedIn: false,
  ensureWallets: async () => {},
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
  const client = useReactiveClient(dynamicClient);
  const userWallets = client.wallets.userWallets ?? [];
  const evmAccount = userWallets.find(w => w.chain === "EVM") ?? null;
  const solanaAccount = userWallets.find(w => w.chain === "SOL") ?? null;
  const loggedIn = client.auth.authenticatedUser !== undefined;

  const disconnect = useCallback(async () => {
    await logout(dynamicClient);
  }, []);

  const ensureWallets = useCallback(async () => {
    if (!loggedIn) return;
    try {
      const wallets = dynamicClient.wallets.userWallets ?? [];
      if (!wallets.some(w => w.chain === "EVM")) {
        await dynamicClient.wallets.embedded.createWallet({ chain: "EVM" });
      }
      if (!wallets.some(w => w.chain === "SOL")) {
        await dynamicClient.wallets.embedded.createWallet({ chain: "SOL" });
      }
    } catch {}
  }, [loggedIn]);

  useEffect(() => {
    const handleOAuthRedirect = async () => {
      if (typeof window === "undefined") return;
      try {
        const url = new URL(window.location.href);
        if (await detectOAuthRedirect({ url }, dynamicClient)) {
          await completeSocialAuthentication({ url }, dynamicClient);
          await ensureWallets();
          window.history.replaceState({}, "", window.location.pathname);
        }
      } catch {}
    };
    handleOAuthRedirect();
  }, [ensureWallets]);

  return (
    <WalletContext.Provider value={{ evmAccount, solanaAccount, loggedIn, ensureWallets, disconnect }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WalletContext.Provider>
  );
}
