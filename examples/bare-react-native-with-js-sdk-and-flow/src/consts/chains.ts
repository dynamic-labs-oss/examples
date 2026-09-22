/**
 * Everything a Flow needs to know about a chain, per chain this app runs on.
 *
 * A Flow's create call names the chain, the settlement token and its
 * decimals, and none of it is derivable from the connected wallet — the
 * wallet only says which chain it is on. So each chain the picker can return
 * needs an entry here for both directions to be expressible.
 */
import type { Chain } from '@dynamic-labs-sdk/client';

export type FlowToken = {
  symbol: string;
  /** Contract address on EVM, mint address on Solana. */
  address: string;
  decimals: number;
};

export type FlowChain = {
  /** Display name, used in copy the user reads. */
  label: string;
  /** Flow's own chain ID for this chain, as the API expects it. */
  chainId: string;
  /** The stablecoin both directions route through. */
  usdc: FlowToken;
  /** What the wallet pays on a deposit and receives on a withdrawal. */
  native: FlowToken;
  /** Example address, shown in the destination field. */
  addressPlaceholder: string;
};

/**
 * Only the chains with a registered extension and a Flow-supported swap
 * rail. A wallet connected on anything else has no entry, which the routes
 * surface as an error rather than guessing at a token.
 */
export const FLOW_CHAINS: Partial<Record<Chain, FlowChain>> = {
  EVM: {
    addressPlaceholder: '0x…',
    chainId: '8453',
    label: 'Base',
    native: {
      // Flow's convention for a chain's own coin rather than a token on it.
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'ETH',
    },
    usdc: {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      decimals: 6,
      symbol: 'USDC',
    },
  },
  SOL: {
    addressPlaceholder: 'Base58 address…',
    chainId: '101',
    label: 'Solana',
    native: {
      // Wrapped SOL's mint: Solana has no zero address, and this is the mint
      // every swap rail quotes native SOL against.
      address: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      symbol: 'SOL',
    },
    usdc: {
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      symbol: 'USDC',
    },
  },
};

/** "Base or Solana" — for telling the user which wallets get them somewhere. */
export const SUPPORTED_CHAIN_LABELS = Object.values(FLOW_CHAINS)
  .map(chain => chain.label)
  .join(' or ');
