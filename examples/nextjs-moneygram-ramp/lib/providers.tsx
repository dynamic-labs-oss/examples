"use client";

import { dynamicClient, initDynamic } from "@/lib/dynamic";
import {
  completeSocialRedirect,
  detectSocialRedirectUrl,
} from "@dynamic-labs-sdk/client";
import {
  createWaasWalletAccounts,
  getChainsMissingWaasWalletAccounts,
} from "@dynamic-labs-sdk/client/waas";
import { DynamicProvider, useEvent } from "@dynamic-labs-sdk/react-hooks";
import { useEffect } from "react";
import { Toaster } from "sonner";

/**
 * Initializes the client, then completes the Google OAuth redirect (returns
 * with ?dynamicOauthCode=…) so the user is hydrated after social sign-in.
 */
function DynamicBootstrap() {
  useEffect(() => {
    let cancelled = false;
    initDynamic().then(async () => {
      if (cancelled || typeof globalThis.window === "undefined") return;
      try {
        const url = new URL(globalThis.location.href);
        if (await detectSocialRedirectUrl({ url })) {
          await completeSocialRedirect({ url });
          globalThis.history.replaceState({}, "", globalThis.location.pathname);
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
 * Once a user signs in, create embedded wallets for any enabled chain that's
 * missing one — using getChainsMissingWaasWalletAccounts() rather than an
 * accounts.length check, which can be momentarily stale right after auth.
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

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <DynamicProvider client={dynamicClient}>
      <DynamicBootstrap />
      <WalletBootstrap />
      {children}
      <Toaster position="bottom-center" theme="light" />
    </DynamicProvider>
  );
}
