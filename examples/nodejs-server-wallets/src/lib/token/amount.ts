/**
 * Token Amount Conversion
 *
 * Chain-agnostic conversion between human-readable amounts and base units. Sits
 * beside `token/evm.ts` and `token/svm.ts` but imports neither — scaling by a
 * decimals value is the same arithmetic everywhere.
 *
 * ## Why not just viem's parseUnits
 *
 * `parseUnits` **rounds** excess precision instead of rejecting it:
 *
 *   parseUnits("1.999999999", 6) -> 2000000n   // "1.999999999" became 2 USDC
 *
 * Rounding silently moves the amount, and upward at that. For a transfer, an
 * amount the token cannot represent is a caller mistake worth surfacing, not
 * something to quietly adjust — so `toBaseUnits` refuses it.
 */

import { formatUnits, parseUnits } from "viem";

/** Decimal amount: digits, optionally one dot with more digits. No sign, no exponent. */
const DECIMAL_AMOUNT = /^\d+(\.\d+)?$/;

/**
 * Check an amount is a well-formed non-negative decimal.
 *
 * Split out from `toBaseUnits` so a CLI can reject bad input before doing any
 * network work — scaling needs the token's decimals, but the *format* doesn't.
 *
 * @throws if the amount isn't a non-negative decimal in whole units.
 */
export function assertDecimalAmount(amount: string): string {
  const trimmed = amount.trim();

  // Rejecting exponent and signed forms up front keeps the round-trip check in
  // `toBaseUnits` meaningful — "1e-9" would compare against a decimal rendering.
  if (!DECIMAL_AMOUNT.test(trimmed)) {
    throw new Error(
      `"${amount}" is not a valid amount. Use a non-negative decimal in whole ` +
        `units, like "1.5" — not base units, and no exponent notation.`,
    );
  }

  return trimmed;
}

/**
 * Convert a human-readable amount to base units.
 *
 *   toBaseUnits("1.5", 6) -> 1500000n
 *
 * @throws if the amount isn't a non-negative decimal, or carries more precision
 * than `decimals` can represent.
 */
export function toBaseUnits(amount: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`decimals must be a non-negative integer, got ${decimals}`);
  }

  const trimmed = assertDecimalAmount(amount);

  const baseUnits = parseUnits(trimmed, decimals);

  // Round-trip to catch the rounding described above: if rendering the result
  // doesn't reproduce the input, precision was lost.
  if (formatUnits(baseUnits, decimals) !== normalize(trimmed)) {
    throw new Error(
      `"${amount}" has more precision than this token's ${decimals} decimals ` +
        `can represent. Rounding it would change the amount transferred.`,
    );
  }

  return baseUnits;
}

/**
 * Render base units as a human-readable amount, the inverse of `toBaseUnits`.
 *
 *   fromBaseUnits(1500000n, 6) -> "1.5"
 */
export function fromBaseUnits(baseUnits: bigint, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`decimals must be a non-negative integer, got ${decimals}`);
  }

  return formatUnits(baseUnits, decimals);
}

/**
 * Strip insignificant zeros so the input can be compared with `formatUnits`
 * output, which never emits them: "01.50" and "1.5" are the same amount.
 */
function normalize(amount: string): string {
  const [whole, fraction = ""] = amount.split(".");

  // The lookahead keeps a lone "0" intact rather than emptying it.
  const significantWhole = whole.replace(/^0+(?=\d)/, "");
  const significantFraction = fraction.replace(/0+$/, "");

  return significantFraction
    ? `${significantWhole}.${significantFraction}`
    : significantWhole;
}
