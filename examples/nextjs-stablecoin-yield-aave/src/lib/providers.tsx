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
  getActiveNetworkId,
} from "@dynamic-labs-sdk/client";
import { createWaasWalletAccounts } from "@dynamic-labs-sdk/client/waas";
import {
  isEvmWalletAccount,
  type EvmWalletAccount,
} from "@dynamic-labs-sdk/evm";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AaveProvider } from "@aave/react";
import { base } from "viem/chains";
import { client } from "./aave";
import { dynamicClient } from "./dynamic";

interface WalletContextValue {
  evmAccount: EvmWalletAccount | null;
  loggedIn: boolean;
  chainId: number;
  setChainId: (id: number) => void;
  ensureEvmWallet: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue>({
  evmAccount: null,
  loggedIn: false,
  chainId: base.id,
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
  const [evmAccount, setEvmAccount] = useState<EvmWalletAccount | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [chainId, setChainId] = useState<number>(base.id);

  const refresh = useCallback(() => {
    const accounts = getWalletAccounts(dynamicClient);
    const evm = accounts.find(isEvmWalletAccount) ?? null;
    setEvmAccount(evm);
    setLoggedIn(isSignedIn(dynamicClient));
  }, []);

  useEffect(() => {
    if (!evmAccount) return;
    getActiveNetworkId({ walletAccount: evmAccount }, dynamicClient)
      .then((result) => setChainId(Number(result.networkId)))
      .catch(() => {});
  }, [evmAccount]);

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
    } catch {}
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleOAuthRedirect = async () => {
      if (typeof window === "undefined") return;
      try {
        const url = new URL(window.location.href);
        const isOAuth = await detectOAuthRedirect({ url }, dynamicClient);
        if (isOAuth) {
          await completeSocialAuthentication({ url }, dynamicClient);
          await ensureEvmWallet();
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
      } catch {}
      refresh();
    };
    handleOAuthRedirect();
    const unsubWallets = onEvent(
      { event: "walletAccountsChanged", listener: () => ensureEvmWallet() },
      dynamicClient
    );
    const unsubLogout = onEvent(
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
      unsubWallets();
      unsubLogout();
    };
  }, [refresh, ensureEvmWallet]);

  return (
    <WalletContext.Provider
      value={{ evmAccount, loggedIn, chainId, setChainId, ensureEvmWallet, disconnect }}
    >
      <QueryClientProvider client={queryClient}>
        <AaveProvider client={client}>{children}</AaveProvider>
      </QueryClientProvider>
    </WalletContext.Provider>
  );
}
