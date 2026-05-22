"use client";

/**
 * Transaction History
 *
 * Fetch paginated transaction history for a wallet address.
 *
 * @see https://www.dynamic.xyz/docs/javascript/reference/wallets/get-transaction-history
 */

import {
  getTransactionHistory as sdkGetTransactionHistory,
  type GetTransactionHistoryParams,
  type GetTransactionHistoryResponse,
} from "@dynamic-labs-sdk/client";
import { getClient } from "./client";

/**
 * Get the transaction history for a wallet address.
 * Returns a paginated list of transactions for the specified address and network.
 *
 * @param params.address - The wallet address to fetch transactions for
 * @param params.chain - The chain to query transactions for (e.g., "SOL")
 * @param params.networkId - The network ID (e.g., 101 for Solana mainnet)
 * @param params.limit - Maximum number of transactions to return
 * @param params.offset - Pagination offset from previous response
 * @returns Promise with transactions array and nextOffset for pagination
 *
 * @example
 * ```ts
 * const { transactions, nextOffset } = await getTransactionHistory({
 *   address: walletAddress,
 *   chain: "SOL",
 *   networkId: 101,
 *   limit: 10,
 * });
 * ```
 */
export async function getTransactionHistory(
  params: GetTransactionHistoryParams,
): Promise<GetTransactionHistoryResponse> {
  const client = getClient();
  if (!client) return { transactions: [], nextOffset: undefined };

  try {
    return await sdkGetTransactionHistory(params);
  } catch {
    return { transactions: [], nextOffset: undefined };
  }
}

export type { GetTransactionHistoryParams, GetTransactionHistoryResponse };
