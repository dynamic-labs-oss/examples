/**
 * Whether an address looks like it belongs on a chain.
 *
 * A shape check, not a validity check — it catches the destination left over
 * from a wallet on another chain, which otherwise reaches Flow's create call
 * and fails there instead of in the form.
 */
import type { Chain } from '@dynamic-labs-sdk/client';

const ADDRESS_SHAPES: Partial<Record<Chain, RegExp>> = {
  EVM: /^0x[0-9a-fA-F]{40}$/,
  // Base58 has no 0, O, I or l, and an encoded 32-byte key lands in this
  // length range.
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
};

export function isValidAddressForChain(address: string, chain: Chain): boolean {
  const shape = ADDRESS_SHAPES[chain];

  // An unlisted chain has no shape to check against, so anything passes and
  // Flow's create call is left to reject it.
  return shape ? shape.test(address.trim()) : true;
}
