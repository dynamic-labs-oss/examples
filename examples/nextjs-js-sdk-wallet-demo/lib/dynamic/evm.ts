"use client";

/**
 * EVM Transactions (via viem)
 *
 * Create viem WalletClient instances for sending transactions on EVM chains.
 *
 * @see https://www.dynamic.xyz/docs/javascript/reference/evm/getting-viem-wallet-client
 */

import { createWalletClientForWalletAccount as sdkCreateWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";

/**
 * Create a viem WalletClient for an EVM wallet account.
 * Use this to send transactions on EVM chains.
 *
 * @see https://www.dynamic.xyz/docs/javascript/reference/evm/getting-viem-wallet-client#page-title
 */
export const createWalletClientForWalletAccount =
  sdkCreateWalletClientForWalletAccount;
