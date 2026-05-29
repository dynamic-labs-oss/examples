"use client";

import { useEffect } from "react";
import { DynamicProvider, useEvent } from "@dynamic-labs-sdk/react-hooks";
import {
  completeSocialRedirect,
  detectSocialRedirectUrl,
} from "@dynamic-labs-sdk/client";
import {
  createWaasWalletAccounts,
  getChainsMissingWaasWalletAccounts,
} from "@dynamic-labs-sdk/client/waas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { dynamicClient, initDynamic } from "./dynamic";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Initializes the Dynamic client on mount and completes the Google OAuth
 * redirect. Social sign-in returns to the app with a `?dynamicOauthCode=…`
 * param — `completeSocialRedirect` consumes it to finish authentication.
 * Without this the token is set but the user is never hydrated.
 */
function DynamicBootstrap() {
  useEffect(() => {
    let cancelled = false;
    initDynamic().then(async () => {
      if (cancelled || typeof window === "undefined") return;
      try {
        const url = new URL(window.location.href);
        if (await detectSocialRedirectUrl({ url })) {
          await completeSocialRedirect({ url });
          window.history.replaceState({}, "", window.location.pathname);
        }
      } catch {
        /* not a social redirect */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

/**
 * Once a user signs in, ensure they have embedded EVM + Solana wallets.
 * Uses `getChainsMissingWaasWalletAccounts()` rather than guarding on
 * `accounts.length === 0` — the account list can be momentarily stale right
 * after auth, which would otherwise silently skip wallet creation.
 */
function WalletBootstrap() {
  useEvent({
    event: "userChanged",
    listener: async (user) => {
      if (!user) return;
      const missing = getChainsMissingWaasWalletAccounts(dynamicClient);
      if (missing.length > 0) {
        await createWaasWalletAccounts({ chains: missing }, dynamicClient);
      }
    },
  });
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DynamicProvider client={dynamicClient}>
      <QueryClientProvider client={queryClient}>
        <DynamicBootstrap />
        <WalletBootstrap />
        {children}
      </QueryClientProvider>
    </DynamicProvider>
  );
}
