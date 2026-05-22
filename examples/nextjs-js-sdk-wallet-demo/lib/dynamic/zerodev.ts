"use client";

/**
 * ZeroDev — Account Abstraction & Gas Sponsorship
 *
 * Create kernel clients for gas-sponsored transactions and manage
 * EIP-7702 authorization for smart wallet accounts.
 *
 * @see https://www.dynamic.xyz/docs/javascript/reference/zerodev
 */

import {
  createKernelClientForWalletAccount as sdkCreateKernelClientForWalletAccount,
  isGasSponsorshipError as sdkIsGasSponsorshipError,
  canSponsorUserOperation as sdkCanSponsorUserOperation,
  signEip7702Authorization as sdkSignEip7702Authorization,
} from "@dynamic-labs-sdk/zerodev";
import { createAsyncSafeWrapper } from "./client";

/**
 * Create a ZeroDev kernel client for gas-sponsored transactions.
 *
 * @see https://www.dynamic.xyz/docs/javascript/reference/zerodev/create-kernel-client-for-wallet-account
 */
export const createKernelClientForWalletAccount =
  sdkCreateKernelClientForWalletAccount;

/**
 * Check if an error is due to gas sponsorship being unavailable.
 * Use this to implement fallback to user-paid gas.
 */
export const isGasSponsorshipError = sdkIsGasSponsorshipError;

/**
 * Check if a user operation can be sponsored by the configured paymaster.
 *
 * Use this to determine if the user will need to pay gas fees
 * or if the transaction qualifies for gas sponsorship.
 * Requires wallet account and the calls to be sponsored.
 *
 * @see https://www.dynamic.xyz/docs/javascript/reference/zerodev
 */
export const canSponsorUserOperation = sdkCanSponsorUserOperation;

/**
 * Sign an EIP-7702 authorization for a smart wallet account.
 *
 * The SDK handles finding the underlying WaaS wallet, creating the wallet client,
 * and signing the authorization for ZeroDev kernel delegation.
 *
 * The signed authorization can then be passed to `createKernelClientForWalletAccount`
 * via the `eip7702Auth` parameter.
 *
 * @param smartWalletAccount - The ZeroDev smart wallet account to sign for
 * @param networkId - The network ID to scope the authorization to
 * @returns The signed authorization object
 *
 * @example
 * ```ts
 * const auth = await signEip7702Authorization({
 *   smartWalletAccount: zerodevWallet,
 *   networkId: networkData.networkId,
 * });
 * // Pass to kernel client
 * ```
 *
 * @see https://www.dynamic.xyz/docs/javascript/reference/zerodev
 */
export const signEip7702Authorization = createAsyncSafeWrapper(
  sdkSignEip7702Authorization,
);
