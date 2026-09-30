/**
 * Solana Token Metadata
 *
 * SVM counterpart to `token/evm.ts`. Decimals come from the mint account, which is the
 * authoritative source — Dynamic exposes no server-side token metadata lookup.
 */

import { getMint } from "@solana/spl-token";
import { type Connection, PublicKey } from "@solana/web3.js";

/**
 * Raised when the recipient has no associated token account.
 *
 * Lives here rather than in the transfer layer because it is a property of SPL
 * tokens, not of any one flow — both `lib/transfer/svm.ts` and
 * `src/svm/transfer-token.ts` hit it.
 */
export const ERROR_MISSING_ATA =
  "Recipient has no associated token account for this mint. Gas sponsorship " +
  "covers fees but not account rent, so this transfer will not create one — " +
  "have the recipient create their ATA first, or fund its rent separately.";

/**
 * Cache keyed by mint address.
 *
 * An SPL mint fixes its decimals at creation, so the value is immutable and never
 * needs invalidating. Promote to a shared cache in a long-lived service.
 */
const decimalsCache = new Map<string, number>();

/**
 * Read an SPL mint's decimals, memoized.
 *
 * @param connection - Connection to the cluster the mint lives on
 * @param mint - Mint address
 */
export async function readSvmTokenDecimals(
  connection: Connection,
  mint: PublicKey | string,
): Promise<number> {
  const mintKey = typeof mint === "string" ? new PublicKey(mint) : mint;
  const cacheKey = mintKey.toBase58();

  const cached = decimalsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const { decimals } = await getMint(connection, mintKey);

  decimalsCache.set(cacheKey, decimals);
  return decimals;
}
