export type SolanaChainId = '101' | '103';

export const SOL_CHAIN_IDS = {
  mainnet: '101' as SolanaChainId,
  devnet:  '103' as SolanaChainId,
} as const;

export const NETWORK_LABEL: Record<SolanaChainId, string> = {
  '101': 'Mainnet',
  '103': 'Devnet',
};

export const USDC_MINT_BY_CHAIN: Record<SolanaChainId, string> = {
  '101': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  '103': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
};
