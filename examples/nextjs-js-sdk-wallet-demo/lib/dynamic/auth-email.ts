"use client";

/**
 * Email OTP Authentication
 *
 * Passwordless email authentication using one-time passwords.
 * These functions wait for client initialization before executing
 * to ensure auth state is ready.
 *
 * @see https://www.dynamic.xyz/docs/javascript/authentication-methods/email
 */

import {
  sendEmailOTP as sdkSendEmailOTP,
  verifyOTP as sdkVerifyOTP,
  waitForClientInitialized as sdkWaitForClientInitialized,
  type OTPVerification,
  type VerifyResponse,
} from "@dynamic-labs-sdk/client";
import { getClient } from "./client";

/**
 * Check if email OTP authentication should be shown.
 *
 * Reads from `projectSettings.providers` for the entry with `provider === 'dynamic'`
 * and checks that `enabledAt` is not null (the provider is always present, but
 * `enabledAt` is only set when email auth is enabled in the dashboard).
 *
 * @returns true if the dynamic (email) provider is enabled in the project
 *
 * @see https://www.dynamic.xyz/docs/javascript/authentication-methods/email
 */
export function isEmailAuthEnabled(): boolean {
  const client = getClient();
  if (!client?.projectSettings) return false;

  const dynamicProvider = client.projectSettings.providers?.find(
    (p) => p.provider === "dynamic",
  );
  return dynamicProvider?.enabledAt != null;
}

/**
 * Send OTP code to user's email.
 * Waits for client initialization before sending.
 */
export async function sendEmailOTP(params: {
  email: string;
}): Promise<OTPVerification> {
  const client = getClient();
  if (!client) throw new Error("Dynamic client not initialized");

  // Ensure client is fully initialized before auth operations
  await sdkWaitForClientInitialized(client);
  return sdkSendEmailOTP(params);
}

/**
 * Verify the OTP code entered by user.
 * Waits for client initialization before verifying.
 */
export async function verifyOTP(params: {
  otpVerification: OTPVerification;
  verificationToken: string;
}): Promise<VerifyResponse> {
  const client = getClient();
  if (!client) throw new Error("Dynamic client not initialized");

  await sdkWaitForClientInitialized(client);
  return sdkVerifyOTP(params);
}
