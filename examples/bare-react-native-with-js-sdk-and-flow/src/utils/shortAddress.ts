/** `0x1234…abcd` — used anywhere a full address would be too wide to show. */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
