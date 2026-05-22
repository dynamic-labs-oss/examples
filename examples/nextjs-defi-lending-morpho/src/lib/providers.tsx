"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useReactiveClient } from "@dynamic-labs/react-hooks";
import type { Wallet } from "@dynamic-labs/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { dynamicClient } from "./dynamic";

interface WalletContextValue {
  evmAccount: Wallet | null;
  loggedIn: boolean;
  chainId: number;
  setChainId: (id: number) => void;
  ensureEvmWallet: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue>({
  evmAccount: null,
  loggedIn: false,
  chainId: 8453, // Base default
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

export default function Providers({ children }: { children: ReactNode }) {
  const client = useReactiveClient(dynamicClient);
  const loggedIn = client.auth.authenticatedUser !== undefined;
  const evmAccount = client.wallets.userWallets?.find((w) => w.chain === "EVM") ?? null;
  const [chainId, setChainId] = useState<number>(8453); // Base default

  // TODO: getActiveNetworkId is not available in @dynamic-labs/client.
  // chainId defaults to Base (8453) and can be updated via setChainId.
  useEffect(() => {
    if (!evmAccount) return;
    // Network switching is managed externally via setChainId
  }, [evmAccount]);

  const disconnect = useCallback(async () => {
    await dynamicClient.auth.logout();
  }, []);

  const ensureEvmWallet = useCallback(async () => {
    try {
      const hasEvm = dynamicClient.wallets.userWallets?.some((w) => w.chain === "EVM");
      if (!hasEvm && dynamicClient.auth.authenticatedUser !== undefined) {
        await dynamicClient.wallets.embedded.createWallet({ chain: "EVM" });
      }
    } catch {}
  }, []);

  // Handle OAuth redirect on mount
  // TODO: detectOAuthRedirect / completeSocialAuthentication are not yet available
  // in @dynamic-labs/client — the reactive client handles auth state automatically.

  return (
    <WalletContext.Provider
      value={{ evmAccount, loggedIn, chainId, setChainId, ensureEvmWallet, disconnect }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WalletContext.Provider>
  );
}
