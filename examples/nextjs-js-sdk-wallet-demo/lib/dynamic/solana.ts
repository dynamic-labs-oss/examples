"use client";

/**
 * Solana Transactions
 *
 * Sign and send transactions on Solana, with optional gas sponsorship.
 *
 * @see https://www.dynamic.xyz/docs/javascript/reference/solana/signing-sending-transactions
 * @see https://www.dynamic.xyz/docs/javascript/reference/solana/svm-gas-sponsorship
 */

import {
  signAndSendTransaction as sdkSignAndSendTransaction,
  signAndSendSponsoredTransaction as sdkSignAndSendSponsoredTransaction,
  SponsorTransactionError as SdkSponsorTransactionError,
} from "@dynamic-labs-sdk/solana";

/**
 * Sign and send a Solana transaction.
 * The wallet account must be a Solana wallet.
 */
export const signAndSendTransaction = sdkSignAndSendTransaction;

/**
 * Sign and send a sponsored Solana transaction.
 *
 * When called, the SDK:
 * 1. Sends the transaction to Dynamic's backend for sponsorship
 * 2. Replaces the fee payer with Dynamic's sponsored account
 * 3. Signs the sponsored transaction with the user's wallet
 * 4. Broadcasts to the network with `skipPreflight: true` by default
 *
 * If sponsorship fails, a `SponsorTransactionError` is thrown — there is no silent fallback.
 *
 * @see https://www.dynamic.xyz/docs/javascript/reference/solana/svm-gas-sponsorship
 */
export const signAndSendSponsoredTransaction =
  sdkSignAndSendSponsoredTransaction;

/**
 * Error thrown when SVM gas sponsorship fails.
 *
 * This can happen when:
 * - The sponsorship API cannot sponsor the transaction
 * - The wallet provider does not support sponsored transactions (e.g. external wallets)
 */
export const SponsorTransactionError = SdkSponsorTransactionError;
