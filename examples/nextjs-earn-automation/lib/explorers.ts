// Block-explorer bases for the networks enabled in the Dynamic environment.
// Kept as a small static map (rather than importing viem's full chain list) so
// it stays out of the client bundle. Values match viem's `blockExplorers.default`.
const EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io",
  137: "https://polygonscan.com",
  8453: "https://basescan.org",
  42161: "https://arbiscan.io",
  143: "https://monadvision.com",
  988: "https://stablescan.xyz",
};

/** Explorer URL for a transaction, or undefined for chains we don't know. */
export function txUrl(chainId: number, txHash: string): string | undefined {
  const base = EXPLORERS[chainId];
  return base ? `${base}/tx/${txHash}` : undefined;
}

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum",
  143: "Monad",
  988: "Stable",
};

/** Human-readable network name, falling back to the chain id. */
export function chainName(chainId: number): string {
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}
