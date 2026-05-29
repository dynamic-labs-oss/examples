"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  DynamicProvider,
  useUser,
  useWalletAccounts,
} from "@dynamic-labs-sdk/react-hooks";
import {
  logout,
  isSignedIn,
  detectSocialRedirectUrl,
  completeSocialRedirect,
  type WalletAccount,
} from "@dynamic-labs-sdk/client";
import {
  createWaasWalletAccounts,
  getChainsMissingWaasWalletAccounts,
} from "@dynamic-labs-sdk/client/waas";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { isSolanaWalletAccount } from "@dynamic-labs-sdk/solana";
import { Toaster } from "sonner";
import { dynamicClient, initDynamic } from "@/lib/dynamic";

interface WalletContextValue {
  walletAccounts: WalletAccount[];
  evmAccount: WalletAccount | null;
  solanaAccount: WalletAccount | null;
  loggedIn: boolean;
  email: string | null;
  ensureWallets: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue>({
  walletAccounts: [],
  evmAccount: null,
  solanaAccount: null,
  loggedIn: false,
  email: null,
  ensureWallets: async () => {},
  disconnect: async () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

function InnerProviders({ children }: { children: ReactNode }) {
  const user = useUser();
  const walletAccounts = useWalletAccounts();
  const loggedIn = user !== null;
  const evmAccount = walletAccounts.find(isEvmWalletAccount) ?? null;
  const solanaAccount = walletAccounts.find(isSolanaWalletAccount) ?? null;

  const disconnect = useCallback(async () => {
    await logout(dynamicClient);
  }, []);

  // Create embedded wallets for any enabled chain that's missing one. Using
  // getChainsMissingWaasWalletAccounts() (rather than an accounts.length check)
  // avoids a stale-list silent skip right after auth.
  const ensureWallets = useCallback(async () => {
    try {
      if (!isSignedIn(dynamicClient)) return;
      const missing = getChainsMissingWaasWalletAccounts(dynamicClient);
      if (missing.length > 0) {
        await createWaasWalletAccounts({ chains: missing }, dynamicClient);
      }
    } catch {
      /* wallet creation will be retried on next auth/login */
    }
  }, []);

  // Initialize the client, then complete the Google OAuth redirect (returns
  // with ?dynamicOauthCode=…) so the user is hydrated after social sign-in.
  useEffect(() => {
    let cancelled = false;
    initDynamic().then(async () => {
      if (cancelled || typeof window === "undefined") return;
      try {
        const url = new URL(window.location.href);
        if (await detectSocialRedirectUrl({ url })) {
          await completeSocialRedirect({ url });
          await ensureWallets();
          window.history.replaceState({}, "", window.location.pathname);
        }
      } catch {
        /* not a social redirect */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ensureWallets]);

  useEffect(() => {
    if (loggedIn) void ensureWallets();
  }, [loggedIn, ensureWallets]);

  return (
    <WalletContext.Provider
      value={{
        walletAccounts,
        evmAccount,
        solanaAccount,
        loggedIn,
        email: user?.email ?? null,
        ensureWallets,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <DynamicProvider client={dynamicClient}>
      <InnerProviders>{children}</InnerProviders>
      <Toaster position="bottom-center" theme="light" />
    </DynamicProvider>
  );
}
