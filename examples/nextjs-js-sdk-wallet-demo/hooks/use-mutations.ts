"use client";

/**
 * React Query Mutations for Dynamic SDK Operations
 *
 * This file centralizes all mutations (write operations) using TanStack Query.
 * Benefits:
 * - Automatic loading/error states via isPending, error
 * - Cache invalidation on success
 * - Consistent error handling patterns
 *
 * @see https://tanstack.com/query/latest/docs/react/guides/mutations
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SocialProvider } from "@dynamic-labs-sdk/client";
import {
  createWaasWalletAccounts,
  sendEmailOTP,
  verifyOTP,
  authenticateWithSocial,
  signInWithExternalJwt,
  logout,
  type OTPVerification,
  type Chain,
} from "@/lib/dynamic";
import {
  sendTransaction,
  type SendTransactionParams,
} from "@/lib/transactions/send-transaction";
import {
  sign7702Authorization,
  type Sign7702Params,
} from "@/lib/transactions/sign-7702-authorization";

// =============================================================================
// AUTH MUTATIONS
// =============================================================================

/**
 * Send OTP to user's email for passwordless authentication
 *
 * @returns OTPVerification object needed to verify the code
 *
 * @example
 * ```tsx
 * const sendOTP = useSendEmailOTP();
 * const otpVerification = await sendOTP.mutateAsync("user@example.com");
 * ```
 */
export function useSendEmailOTP() {
  return useMutation({
    mutationFn: (email: string) => sendEmailOTP({ email }),
  });
}

/**
 * Verify the OTP code entered by the user
 * Completes the email authentication flow
 *
 * @example
 * ```tsx
 * const verifyOTP = useVerifyOTP();
 * await verifyOTP.mutateAsync({ otpVerification, otp: "123456" });
 * ```
 */
export function useVerifyOTP() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      otpVerification,
      otp,
    }: {
      otpVerification: OTPVerification;
      otp: string;
    }) =>
      verifyOTP({
        otpVerification,
        verificationToken: otp,
      }),
    onSuccess: () => {
      // Refresh wallet accounts after successful login
      queryClient.invalidateQueries({ queryKey: ["walletAccounts"] });
    },
  });
}

/**
 * Initiate social OAuth flow for a given provider
 * Redirects user to the provider, then back to the app
 *
 * Note: OAuth completion is handled in SocialProvidersSection via completeSocialAuthentication
 *
 * @see https://www.dynamic.xyz/docs/javascript/authentication-methods/social
 *
 * @example
 * ```tsx
 * const socialAuth = useSocialAuth();
 * await socialAuth.mutateAsync("google");
 * ```
 */
export function useSocialAuth() {
  return useMutation({
    mutationFn: (provider: SocialProvider) =>
      authenticateWithSocial({
        provider,
        redirectUrl: window.location.href,
      }),
  });
}

/**
 * Sign in with an external JWT token
 * Used to authenticate via a third-party auth provider
 *
 * Note: Requires External Authentication to be configured in the Dynamic dashboard
 *
 * @see https://www.dynamic.xyz/docs/javascript/external-auth/third-party-auth-setup
 * @see https://www.dynamic.xyz/docs/javascript/external-auth/third-party-auth-usage
 *
 * @example
 * ```tsx
 * const jwtAuth = useJwtAuth();
 * await jwtAuth.mutateAsync("eyJhbG...");
 * ```
 */
export function useJwtAuth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jwt: string) => signInWithExternalJwt({ externalJwt: jwt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["walletAccounts"] });
    },
  });
}

/**
 * Log out the current user
 * Clears all cached queries on success
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

// =============================================================================
// WALLET MUTATIONS
// =============================================================================

/**
 * Create a new embedded wallet (WaaS) for the authenticated user
 *
 * @param chain - Chain type from Dynamic SDK (e.g., "EVM", "SOL")
 *
 * Note: WaaS wallets are permanently tied to the user's account
 * and cannot be deleted.
 *
 * @example
 * ```tsx
 * const createWallet = useCreateWallet();
 * await createWallet.mutateAsync("EVM");
 * ```
 */
export function useCreateWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chain: Chain) => createWaasWalletAccounts({ chains: [chain] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["walletAccounts"] });
    },
  });
}

// =============================================================================
// TRANSACTION MUTATIONS
// =============================================================================

/**
 * Send a transaction from an embedded wallet
 *
 * Automatically handles:
 * - Chain detection (EVM vs Solana)
 * - ZeroDev gas sponsorship for EVM (with fallback)
 * - Transaction signing and broadcasting
 *
 * @returns Transaction hash on success
 *
 * @example
 * ```tsx
 * const sendTx = useSendTransaction();
 * const txHash = await sendTx.mutateAsync({
 *   walletAccount,
 *   amount: "0.001",
 *   recipient: "0x...",
 *   networkData,
 *   allWalletAccounts,
 * });
 * ```
 */
export function useSendTransaction() {
  return useMutation({
    mutationFn: (params: SendTransactionParams) => sendTransaction(params),
  });
}

// =============================================================================
// EIP-7702 AUTHORIZATION SIGNING
// =============================================================================

/**
 * Sign EIP-7702 authorization to enable smart account features
 *
 * This ONLY signs the authorization - no transaction is sent.
 * The signed authorization should be passed to sendTransaction
 * when sending the first transaction on this network.
 *
 * Requires only 1 MFA code (singleUse: true).
 *
 * @returns The signed authorization
 *
 * @example
 * ```tsx
 * const sign = useSign7702();
 * const auth = await sign.mutateAsync({
 *   walletAccount: zerodevWallet,
 *   networkData,
 *   mfaCode: "123456",
 * });
 * // Pass auth to sendEvmTransaction
 * ```
 */
export function useSign7702() {
  return useMutation({
    mutationFn: (params: Sign7702Params) => sign7702Authorization(params),
  });
}
