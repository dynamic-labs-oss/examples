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
import {
  isSolanaWalletAccount,
  type SolanaWalletAccount,
} from "@dynamic-labs-sdk/solana";
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

export function Providers({ children }: { children: ReactNode }) {
  const [evmAccount, setEvmAccount] = useState<EvmWalletAccount | null>(null);
  const [solanaAccount, setSolanaAccount] = useState<SolanaWalletAccount | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  const refresh = useCallback(() => {
    const accounts = getWalletAccounts(dynamicClient);
    setEvmAccount(accounts.find(isEvmWalletAccount) ?? null);
    setSolanaAccount(accounts.find(isSolanaWalletAccount) ?? null);
    setLoggedIn(isSignedIn(dynamicClient));
  }, []);

  const disconnect = useCallback(async () => {
    await logout(dynamicClient);
    setEvmAccount(null);
    setSolanaAccount(null);
    setLoggedIn(false);
  }, []);

  const ensureWallets = useCallback(async () => {
    try {
      const accounts = getWalletAccounts(dynamicClient);
      const hasEvm = accounts.some(isEvmWalletAccount);
      const hasSolana = accounts.some(isSolanaWalletAccount);
      if (isSignedIn(dynamicClient)) {
        const chainsToCreate: ("EVM" | "SOL")[] = [];
        if (!hasEvm) chainsToCreate.push("EVM");
        if (!hasSolana) chainsToCreate.push("SOL");
        if (chainsToCreate.length > 0) {
          await createWaasWalletAccounts({ chains: chainsToCreate }, dynamicClient);
        }
      }
    } catch {}
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleOAuthRedirect = async () => {
      if (typeof window === "undefined") return;
      try {
        const url = new URL(window.location.href);
        if (await detectOAuthRedirect({ url }, dynamicClient)) {
          await completeSocialAuthentication({ url }, dynamicClient);
          await ensureWallets();
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
      } catch {}
      refresh();
    };
    handleOAuthRedirect();
    const unsub1 = onEvent(
      { event: "walletAccountsChanged", listener: () => ensureWallets() },
      dynamicClient
    );
    const unsub2 = onEvent(
      {
        event: "logout",
        listener: () => {
          setEvmAccount(null);
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
  }, [refresh, ensureWallets]);

  return (
    <WalletContext.Provider value={{ evmAccount, solanaAccount, loggedIn, ensureWallets, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}
