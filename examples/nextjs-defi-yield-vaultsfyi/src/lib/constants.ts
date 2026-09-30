import { DEFAULT_CHAIN_ID } from "./networks";

if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID) {
  // Soft warning rather than throw — keeps the app rendering an
  // "environment not configured" state instead of a blank-screen crash
  // so Pawel sees the misconfig clearly when he runs `pnpm dev`.
  console.warn(
    "NEXT_PUBLIC_DYNAMIC_ENV_ID is not set. Add it to .env.local. See README setup.",
  );
}

export const DYNAMIC_ENV_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID ?? "";

// 1 USDC deposit default — vaults.fyi indexes mainnet vaults only, so the
// runtime test cycle moves real funds. 1 USDC keeps it ~$1 per cycle.
export const DEFAULT_DEPOSIT_AMOUNT = "1";
export { DEFAULT_CHAIN_ID };
