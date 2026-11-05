/**
 * Format an address as "0x1234...abcd".
 */
export function shortAddress(addr?: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Format a decimal APY (0.0432) as a percentage string ("4.32%").
 */
export function formatApy(apy?: number | null): string {
  if (apy === undefined || apy === null) return "—";
  return `${(apy * 100).toFixed(2)}%`;
}

/**
 * Format a token amount (smallest-unit string or bigint) given decimals.
 */
export function formatToken(
  amount: string | bigint | undefined,
  decimals: number,
  precision = 4,
): string {
  if (amount === undefined) return "—";
  const big = typeof amount === "bigint" ? amount : BigInt(amount);
  const divisor = 10n ** BigInt(decimals);
  const whole = big / divisor;
  const frac = big % divisor;
  const fracStr = frac
    .toString()
    .padStart(decimals, "0")
    .slice(0, precision)
    .replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

/**
 * Parse a decimal amount string ("1.5") into smallest-unit bigint given decimals.
 */
export function parseAmount(amount: string, decimals: number): bigint {
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}
