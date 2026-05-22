/**
 * Dynamic SDK — Barrel Export
 *
 * Re-exports all SDK wrapper functions organized by feature.
 * Each feature file is a self-contained reference for one SDK capability.
 *
 * Import from "@/lib/dynamic" in your components:
 * ```ts
 * import { getTransactionHistory, isSignedIn } from "@/lib/dynamic";
 * ```
 *
 * Or import from a specific feature file for focused reference:
 * ```ts
 * import { getTransactionHistory } from "@/lib/dynamic/transaction-history";
 * ```
 */

// Auth
export { isSignedIn, logout } from "./auth";
export { isEmailAuthEnabled, sendEmailOTP, verifyOTP } from "./auth-email";
export {
  authenticateWithSocial,
  detectOAuthRedirect,
  completeSocialAuthentication,
  getEnabledSocialProviders,
  isSocialAuthEnabled,
} from "./auth-social";
export { signInWithExternalJwt, isExternalAuthEnabled } from "./auth-jwt";

// Wallets
export {
  getWalletAccounts,
  createWaasWalletAccounts,
  isWaasWalletAccount,
  isEvmWalletAccount,
  isSolanaWalletAccount,
} from "./wallets";

// Networks
export {
  getNetworksData,
  getActiveNetworkData,
  switchActiveNetwork,
} from "./networks";

// Balance
export { getBalance, getTokenBalances } from "./balance";
export type { TokenBalanceInfo } from "./balance";

// Transaction History
export { getTransactionHistory } from "./transaction-history";

// Wallet Provider
export { getWalletProviderDataByKey } from "./wallet-provider";

// EVM
export { createWalletClientForWalletAccount } from "./evm";

// Solana
export {
  signAndSendTransaction,
  signAndSendSponsoredTransaction,
  SponsorTransactionError,
} from "./solana";

// ZeroDev (Account Abstraction)
export {
  createKernelClientForWalletAccount,
  isGasSponsorshipError,
  canSponsorUserOperation,
  signEip7702Authorization,
} from "./zerodev";

// Gas Sponsorship Config
export {
  getSponsoredNetworkIds,
  isNetworkSponsored,
  isSvmGasSponsorshipEnabled,
} from "./gas-sponsorship";

// MFA
export {
  authenticateTotpMfaDevice,
  getMfaDevices,
  registerTotpMfaDevice,
  isMfaRequiredForAction,
  getMfaSettings,
  MFAAction,
} from "./mfa";

// Events
export { onEvent, offEvent } from "./events";

// Initialization
export { getInitStatus, waitForClientInitialized } from "./init";

// Types
export type {
  WalletAccount,
  EvmWalletAccount,
  SolanaWalletAccount,
  Chain,
} from "./wallets";
export type { NetworkData } from "./networks";
export type { OTPVerification } from "@dynamic-labs-sdk/client";
export type {
  GetTransactionHistoryParams,
  GetTransactionHistoryResponse,
} from "./transaction-history";
export type { InitStatus } from "./init";
export type { MfaSettings } from "./mfa";
