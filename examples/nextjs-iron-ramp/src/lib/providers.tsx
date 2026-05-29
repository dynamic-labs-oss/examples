"use client";

import { useEffect } from "react";
import { DynamicProvider, useUser } from "@dynamic-labs-sdk/react-hooks";
import {
  completeSocialRedirect,
  detectSocialRedirectUrl,
  getWalletAccounts,
} from "@dynamic-labs-sdk/client";
import { createWaasWalletAccounts } from "@dynamic-labs-sdk/client/waas";
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
 * Initializes the Dynamic client on mount and completes any social-login
 * redirect (Google) when the user lands back on the app.
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
 * Once a user is signed in, ensure they have embedded EVM + Solana wallets.
 */
function WalletBootstrap() {
  const user = useUser();
  useEffect(() => {
    if (!user) return;
    if (getWalletAccounts().length === 0) {
      createWaasWalletAccounts(
        { chains: ["EVM", "SOL"] },
        dynamicClient
      ).catch(() => {});
    }
  }, [user]);
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
