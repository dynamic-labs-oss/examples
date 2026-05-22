"use client";

/**
 * Authentication — Sign In / Sign Out
 *
 * Basic auth state checks and logout functionality.
 *
 * @see https://www.dynamic.xyz/docs/javascript/user-session-management
 */

import {
  logout as sdkLogout,
  isSignedIn as sdkIsSignedIn,
} from "@dynamic-labs-sdk/client";
import { getClient, createSafeWrapper } from "./client";

/**
 * Check if user is currently signed in.
 * Returns false during SSR or if client unavailable.
 */
export const isSignedIn = createSafeWrapper(sdkIsSignedIn, false);

/**
 * Log out the current user.
 * Safe to call even if not logged in.
 */
export async function logout(): Promise<void> {
  const client = getClient();
  if (!client) return;
  return sdkLogout();
}
