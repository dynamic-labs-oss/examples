export type Chain = "base" | "ethereum" | "solana";

export interface ChainConfig {
  name: string;
  color: string;
  networkId?: number;
  usdcAddress?: string;
}

export const CHAINS: Record<Chain, ChainConfig> = {
  base: {
    name: "Base",
    color: "#0052FF",
    networkId: 8453,
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  ethereum: {
    name: "Ethereum",
    color: "#627EEA",
    networkId: 1,
    usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  solana: {
    name: "Solana",
    color: "#9945FF",
  },
};

export const CHAIN_ORDER: Chain[] = ["base", "ethereum", "solana"];
export const EVM_CHAINS: Chain[] = ["base", "ethereum"];
