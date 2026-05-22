"use client";

/**
 * Social Authentication (OAuth)
 *
 * Google, GitHub, and other social provider authentication flows.
 * Handles the redirect-based OAuth flow: initiate -> redirect -> complete.
 *
 * @see https://www.dynamic.xyz/docs/javascript/authentication-methods/social
 */

import {
  authenticateWithSocial as sdkAuthenticateWithSocial,
  detectOAuthRedirect as sdkDetectOAuthRedirect,
  completeSocialAuthentication as sdkCompleteSocialAuthentication,
} from "@dynamic-labs-sdk/client";
import { getClient, createAsyncSafeWrapper } from "./client";

/** Initiate social auth flow (redirects to provider) */
export const authenticateWithSocial = createAsyncSafeWrapper(
  sdkAuthenticateWithSocial,
);

/**
 * Detect OAuth redirect from social provider.
 * Safe to call during SSR - just checks URL params.
 */
export const detectOAuthRedirect = sdkDetectOAuthRedirect;

/** Complete social auth after redirect back from provider */
export const completeSocialAuthentication = createAsyncSafeWrapper(
  sdkCompleteSocialAuthentication,
);

/**
 * Get the list of social providers enabled in the dashboard.
 *
 * Reads from `projectSettings.sdk.socialSignIn.providers` which contains
 * all social providers with their `enabled` status.
 *
 * @returns Array of enabled social provider names (e.g., ["google", "github"])
 *
 * @see https://www.dynamic.xyz/docs/javascript/authentication-methods/social
 */
export function getEnabledSocialProviders(): string[] {
  const client = getClient();
  if (!client?.projectSettings) return [];

  return (
    client.projectSettings.sdk?.socialSignIn?.providers
      ?.filter((p) => p.enabled)
      .map((p) => p.provider) ?? []
  );
}

/**
 * Check if any social provider authentication is enabled in the dashboard.
 *
 * @returns true if at least one social provider is enabled
 *
 * @see https://www.dynamic.xyz/docs/javascript/authentication-methods/social
 */
export function isSocialAuthEnabled(): boolean {
  return getEnabledSocialProviders().length > 0;
}
