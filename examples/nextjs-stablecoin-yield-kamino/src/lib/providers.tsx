"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useReactiveClient } from "@dynamic-labs/react-hooks";
import type { Wallet } from "@dynamic-labs/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { dynamicClient } from "./dynamic";

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
  const client = useReactiveClient(dynamicClient);
  const loggedIn = client.auth.authenticatedUser !== undefined;
  const solanaAccount = client.wallets.userWallets?.find((w) => w.chain === "SOL") ?? null;

  const disconnect = useCallback(async () => {
    await dynamicClient.auth.logout();
  }, []);

  // After a successful login (email OTP, Google, or external wallet), ensure
  // the user has a Solana embedded wallet. Silently ignores errors (e.g. wallet
  // already exists or WaaS not enabled for this environment).
  const ensureSolanaWallet = useCallback(async () => {
    try {
      const hasSolana = dynamicClient.wallets.userWallets?.some((w) => w.chain === "SOL");
      if (!hasSolana && dynamicClient.auth.authenticatedUser !== undefined) {
        await dynamicClient.wallets.embedded.createWallet({ chain: "SOL" });
      }
    } catch {
      // wallet may already exist — ignore
    }
  }, []);

  // Handle OAuth redirect (Google sign-in callback)
  // TODO: detectOAuthRedirect / completeSocialAuthentication are not yet available
  // in @dynamic-labs/client — the reactive client handles auth state automatically.

  return (
    <WalletContext.Provider
      value={{ solanaAccount, loggedIn, ensureSolanaWallet, disconnect }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WalletContext.Provider>
  );
}
