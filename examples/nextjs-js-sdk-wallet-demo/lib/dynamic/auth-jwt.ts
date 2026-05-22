"use client";

/**
 * External JWT Authentication
 *
 * Sign in using a third-party JWT token from an external auth provider.
 * Useful for integrating Dynamic with your own authentication system.
 * Requires External Authentication to be configured in the Dynamic dashboard.
 *
 * @see https://www.dynamic.xyz/docs/javascript/external-auth/third-party-auth-overview
 * @see https://www.dynamic.xyz/docs/javascript/external-auth/third-party-auth-setup
 * @see https://www.dynamic.xyz/docs/javascript/external-auth/third-party-auth-usage
 */

import { signInWithExternalJwt as sdkSignInWithExternalJwt } from "@dynamic-labs-sdk/client";
import { getClient, createAsyncSafeWrapper } from "./client";

/** Sign in with an external JWT token */
export const signInWithExternalJwt = createAsyncSafeWrapper(
  sdkSignInWithExternalJwt,
);

/**
 * Check if External Authentication (JWT) is enabled in the dashboard.
 *
 * Reads from `projectSettings.security.externalAuth.enabled` which is
 * configured via the External Authentication page in the Dynamic dashboard.
 *
 * @returns true if external JWT authentication is enabled
 *
 * @see https://www.dynamic.xyz/docs/javascript/external-auth/third-party-auth-setup
 */
export function isExternalAuthEnabled(): boolean {
  const client = getClient();
  if (!client?.projectSettings) return false;

  const externalAuth = client.projectSettings.security?.externalAuth;
  return externalAuth?.enabled ?? false;
}
