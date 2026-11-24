"use client";

// NOTE: do not polyfill BigInt.prototype.toJSON here. It makes @solana/kit send
// getProgramAccounts filter offsets as strings ("expected u64"), which breaks
// every plan/subscription lookup. kit serializes bigints itself.

import { type ReactNode, useEffect } from "react";
import {
  completeSocialAuthentication,
  detectOAuthRedirect,
  onEvent,
} from "@dynamic-labs-sdk/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DynamicProvider } from "@dynamic-labs-sdk/react-hooks";
import { dynamicClient } from "./dynamic";
import { useWallet } from "./useWallet";
import { ChainProvider } from "./chain";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

function AppInit() {
  const { ensureWallets } = useWallet();

  useEffect(() => {
    const unsub = onEvent(
      {
        event: "walletAccountsChanged",
        listener: () => { void ensureWallets(); },
      },
      dynamicClient
    );
    return () => unsub?.();
  }, [ensureWallets]);

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

  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <DynamicProvider client={dynamicClient}>
      <QueryClientProvider client={queryClient}>
        <ChainProvider>
          <AppInit />
          {children}
        </ChainProvider>
      </QueryClientProvider>
    </DynamicProvider>
  );
}
