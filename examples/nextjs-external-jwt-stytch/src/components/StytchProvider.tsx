"use client";

import { ReactNode, useEffect, useRef } from "react";
import { StytchProvider as ProviderActual, useStytch } from "@stytch/nextjs";
import Cookies from "js-cookie";
import { createStytchUIClient } from "@stytch/nextjs/dist/index.ui";
import { signInWithExternalJwt, logout } from "@dynamic-labs-sdk/client";
import {
  createWaasWalletAccounts,
  getChainsMissingWaasWalletAccounts,
} from "@dynamic-labs-sdk/client/waas";
import { dynamicClient } from "./dynamicClient";
import { runOnceAcrossTabs } from "@/lib/runOnceAcrossTabs";

// We initialize the Stytch client using our project's public token which can be found in the Stytch dashboard
const stytch = createStytchUIClient(
  process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN || "",
);

const StytchProvider = ({ children }: { children: ReactNode }) => {
  const jwt = Cookies.get("stytch_session_jwt");
  console.log("jwt", jwt);
  return (
    <ProviderActual stytch={stytch}>
      <StytchDynamicBridge />
      {children}
    </ProviderActual>
  );
};

export default StytchProvider;

/**
 * Bridges Stytch session changes to Dynamic authentication and wallet provisioning
 *
 * This component automatically synchronizes Stytch and Dynamic sessions:
 * 1. When Stytch session starts → Signs into Dynamic using Stytch JWT
 * 2. Automatically creates embedded wallets for missing blockchain networks
 * 3. When Stytch session ends → Logs out of Dynamic
 *
 * Uses runOnceAcrossTabs to prevent duplicate operations when multiple tabs are open.
 */
function StytchDynamicBridge(): null {
  const stytch = useStytch();
  // Track whether we've already synced this session to prevent duplicate operations
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    // Listen for Stytch session changes (login/logout)
    const unsubscribe = stytch.session.onChange(async (session) => {
      console.log("[Stytch] Session changed:", session ? "active" : "ended");

      // Handle logout: Clear Dynamic session when Stytch session ends
      if (!session) {
        console.log("[Dynamic] Logging out due to Stytch session end");
        await logout();
        hasSyncedRef.current = false; // Reset sync flag for next login
        console.log("[Dynamic] Successfully logged out");
        return;
      }

      // Skip if we've already processed this session
      if (hasSyncedRef.current) return;

      // Get the JWT token from Stytch cookies
      const jwt = Cookies.get("stytch_session_jwt");
      if (!jwt) {
        console.warn("[Dynamic] No Stytch JWT found in cookies");
        return;
      }

      try {
        // Use runOnceAcrossTabs to prevent duplicate operations across browser tabs
        await runOnceAcrossTabs(async () => {
          // Step 1: Authenticate with Dynamic using Stytch JWT
          if (!dynamicClient.user) {
            console.log("[Dynamic] Signing in with Stytch JWT...");
            await signInWithExternalJwt({ externalJwt: jwt });
            console.log("[Dynamic] Successfully authenticated with Dynamic");
          } else {
            console.log("[Dynamic] Already authenticated, skipping sign-in");
          }

          // Step 2: Create embedded wallets for any missing blockchain networks
          // This automatically provisions WaaS (Wallet as a Service) accounts
          const missingChains = getChainsMissingWaasWalletAccounts();
          console.log(
            "[Dynamic] Checking for missing wallet chains:",
            missingChains,
          );

          if (missingChains.length > 0) {
            console.log(
              "[Dynamic] Creating embedded wallets for:",
              missingChains,
            );
            await createWaasWalletAccounts({ chains: missingChains });
            console.log("[Dynamic] Embedded wallets created successfully");
          } else {
            console.log("[Dynamic] All wallet chains already exist");
          }

          // Mark this session as synced to prevent duplicate operations
          hasSyncedRef.current = true;
        });
      } catch (error) {
        console.error(
          "[Dynamic] Failed to sync Stytch session with Dynamic:",
          error,
        );
      }
    });

    // Cleanup: Remove the session change listener when component unmounts
    return unsubscribe;
  }, [stytch]); // Re-run effect if Stytch client changes

  // This component doesn't render anything - it's purely for side effects
  return null;
}
