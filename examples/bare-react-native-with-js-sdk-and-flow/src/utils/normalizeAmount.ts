/**
 * `decimal-pad` renders whatever decimal separator the device's region uses
 * (comma vs. period) — this normalizes either input to what `isValidAmount`
 * and `Number()` expect. Ported verbatim from the pre-redesign
 * DepositForm.tsx.
 */
export function normalizeAmount(value: string): string {
  return value.replace(',', '.');
}
