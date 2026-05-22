"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  logout,
  detectOAuthRedirect,
  completeSocialAuthentication,
} from "@dynamic-labs-sdk/client";
import { createWaasWalletAccounts } from "@dynamic-labs-sdk/client/waas";
import {
  isEvmWalletAccount,
  type EvmWalletAccount,
} from "@dynamic-labs-sdk/evm";
import {
  isSolanaWalletAccount,
  type SolanaWalletAccount,
} from "@dynamic-labs-sdk/solana";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  DynamicProvider,
  useUser,
  useWalletAccounts,
  useEvent,
} from "@dynamic-labs-sdk/react-hooks";
import { dynamicClient } from "./dynamic";

interface WalletContextValue {
  evmAccount: EvmWalletAccount | null;
  solanaAccount: SolanaWalletAccount | null;
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

function WalletContextProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const accounts = useWalletAccounts();
  const evmAccount = accounts.find(isEvmWalletAccount) ?? null;
  const solanaAccount = accounts.find(isSolanaWalletAccount) ?? null;
  const loggedIn = user !== null;

  const disconnect = useCallback(async () => {
    await logout(dynamicClient);
  }, []);

  const ensureWallets = useCallback(async () => {
    if (!loggedIn) return;
    try {
      const chainsToCreate: ("EVM" | "SOL")[] = [];
      if (!evmAccount) chainsToCreate.push("EVM");
      if (!solanaAccount) chainsToCreate.push("SOL");
      if (chainsToCreate.length > 0) {
        await createWaasWalletAccounts({ chains: chainsToCreate }, dynamicClient);
      }
    } catch {}
  }, [loggedIn, evmAccount, solanaAccount]);

  useEvent({
    event: "walletAccountsChanged",
    listener: () => { void ensureWallets(); },
  });

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

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <DynamicProvider client={dynamicClient}>
      <WalletContextProvider>{children}</WalletContextProvider>
    </DynamicProvider>
  );
}
