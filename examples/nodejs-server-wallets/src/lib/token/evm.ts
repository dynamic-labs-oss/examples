/**
 * EVM Token Metadata
 *
 * Reading token metadata is a general concern, not a transfer concern — balance
 * display and accounting need it too — so it lives here rather than inside the
 * transfer layer.
 *
 * Dynamic has no server-side lookup for this. The Node SDK exposes no token
 * metadata, and `GET /chains/{chainName}/tokens` returns name / symbol / addresses
 * but no decimals. The contract is the only authoritative source, and unlike a
 * balances index it also covers tokens the wallet doesn't hold yet.
 */

import { erc20Abi, type Hex, type PublicClient } from "viem";

/**
 * Cache keyed by `chainId:address`.
 *
 * ERC-20 exposes `decimals` as a constant, so the value is immutable for the
 * lifetime of the token and never needs invalidating. One read per token per
 * process rather than one per transfer.
 *
 * In a long-lived service, promote this to a shared cache (Redis) so it stays warm
 * across instances and restarts.
 */
const decimalsCache = new Map<string, number>();

/**
 * Read an ERC-20's decimals, memoized.
 *
 * @param publicClient - Viem client for the chain the token lives on
 * @param address - Token contract address
 */
export async function readEvmTokenDecimals(
  publicClient: PublicClient,
  address: Hex,
): Promise<number> {
  const chainId = publicClient.chain?.id ?? 0;
  const cacheKey = `${chainId}:${address.toLowerCase()}`;

  const cached = decimalsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const decimals = await publicClient.readContract({
    address,
    abi: erc20Abi,
    functionName: "decimals",
  });

  decimalsCache.set(cacheKey, decimals);
  return decimals;
}
