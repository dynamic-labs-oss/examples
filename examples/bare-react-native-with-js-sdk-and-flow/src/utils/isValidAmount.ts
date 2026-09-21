/**
 * Shared by DepositRoute and WithdrawRoute, both capped at MAX_AMOUNT_USD —
 * `maxAmount` is the caller's job to derive, this just validates the string
 * against it.
 */
import { normalizeAmount } from './normalizeAmount';

export function isValidAmount(value: string, maxAmount: number): boolean {
  const normalized = normalizeAmount(value);
  return (
    /^\d+(\.\d{1,2})?$/.test(normalized) &&
    Number(normalized) > 0 &&
    Number(normalized) <= maxAmount
  );
}
