"use client";

/**
 * MFA (Multi-Factor Authentication)
 *
 * Action-based MFA using TOTP (Time-based One-Time Passwords) to protect
 * sensitive operations like transactions.
 *
 * @see https://www.dynamic.xyz/docs/javascript/authentication-methods/mfa/action-based
 */

import {
  authenticateTotpMfaDevice as sdkAuthenticateTotpMfaDevice,
  getMfaDevices as sdkGetMfaDevices,
  registerTotpMfaDevice as sdkRegisterTotpMfaDevice,
  isMfaRequiredForAction as sdkIsMfaRequiredForAction,
  MFAAction,
} from "@dynamic-labs-sdk/client";
import { getClient } from "./client";

/**
 * Authenticate with a TOTP (Time-based One-Time Password) MFA device.
 *
 * Use this before performing MFA-protected actions like transactions.
 * Pass `createMfaTokenOptions: { singleUse: true }` to create a token
 * that's consumed by the next protected operation.
 *
 * @example
 * ```ts
 * await authenticateTotpMfaDevice({
 *   code: "123456",
 *   createMfaTokenOptions: { singleUse: true },
 * });
 * // Now send the transaction...
 * ```
 *
 * @see https://www.dynamic.xyz/docs/javascript/authentication-methods/mfa/action-based
 */
export const authenticateTotpMfaDevice = sdkAuthenticateTotpMfaDevice;

/**
 * Get all registered MFA devices for the current user.
 *
 * Use this to check if the user has MFA set up before prompting for a code.
 * Returns an empty array if no devices are registered.
 */
export async function getMfaDevices() {
  const client = getClient();
  if (!client) return [];

  try {
    return await sdkGetMfaDevices();
  } catch {
    return [];
  }
}

/**
 * Register a new TOTP MFA device for the current user.
 *
 * Returns a URI for generating a QR code and a secret key for manual entry.
 * After registration, the user must verify the device using `authenticateTotpMfaDevice`.
 *
 * @returns { uri: string, secret: string } - URI for QR code and secret for manual entry
 *
 * @see https://dynamic.xyz/docs/javascript/authentication-methods/mfa/totp
 */
export const registerTotpMfaDevice = sdkRegisterTotpMfaDevice;

/**
 * Check if MFA is required for a specific action.
 *
 * Use this to determine if the user needs to complete an MFA challenge
 * before performing sensitive operations.
 *
 * @example
 * ```ts
 * const required = await isMfaRequiredForAction({
 *   mfaAction: MFAAction.WalletWaasSign,
 * });
 * if (required) {
 *   // Prompt for MFA code
 * }
 * ```
 *
 * @see https://www.dynamic.xyz/docs/javascript/authentication-methods/mfa/action-based#your-ui-sdk-implementation
 */
export const isMfaRequiredForAction = sdkIsMfaRequiredForAction;

// Re-export MFAAction enum for use in components
export { MFAAction };

/**
 * MFA Settings from environment configuration
 */
export interface MfaSettings {
  /** Whether session-based MFA is enabled */
  sessionMfaEnabled: boolean;
  /** Whether MFA device setup is required at onboarding */
  mfaRequired: boolean;
  /** Whether any action-based MFA is enabled */
  actionMfaEnabled: boolean;
  /** Whether MFA is enabled at all (session or action) */
  isMfaEnabled: boolean;
}

/**
 * Get MFA settings from the environment configuration.
 *
 * This provides direct access to MFA settings from projectSettings,
 * which is more reliable than checking individual actions.
 *
 * @returns MFA settings or null if client not initialized
 */
export function getMfaSettings(): MfaSettings | null {
  const client = getClient();
  if (!client?.projectSettings) return null;

  const mfaConfig = client.projectSettings.security?.mfa;

  const sessionMfaEnabled = mfaConfig?.enabled ?? false;
  const mfaRequired = mfaConfig?.required ?? false;
  const actionMfaEnabled = mfaConfig?.actions?.some((a) => a.required) ?? false;
  const isMfaEnabled = sessionMfaEnabled || actionMfaEnabled;

  return {
    sessionMfaEnabled,
    mfaRequired,
    actionMfaEnabled,
    isMfaEnabled,
  };
}
