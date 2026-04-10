import { baseSepolia, sepolia } from "viem/chains";
import type { Chain } from "viem";
import { env } from "./env";

/**
 * MoneyGram chain identifiers as required by the RAMPS_CONFIG message.
 * Note: use "base" for Base transactions — NOT "ethereum".
 */
export type MgChain = "base" | "ethereum" | "solana";

interface EvmChainConfig {
  type: "evm";
  name: string;
  mgChain: MgChain;
  networkId: number;
  viemChain: Chain;
  usdcAddress: `0x${string}`;
}

interface SolanaChainConfig {
  type: "solana";
  name: string;
  mgChain: MgChain;
  rpcUrl: string;
  usdcMint: string;
}

export type ChainConfig = EvmChainConfig | SolanaChainConfig;

export const CHAINS: Record<MgChain, ChainConfig> = {
  base: {
    type: "evm",
    name: "Base Sepolia",
    mgChain: "base",
    networkId: 84532,
    viemChain: baseSepolia,
    // Circle USDC on Base Sepolia
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  ethereum: {
    type: "evm",
    name: "Eth Sepolia",
    mgChain: "ethereum",
    networkId: 11155111,
    viemChain: sepolia,
    // Circle USDC on Eth Sepolia
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
  solana: {
    type: "solana",
    name: "Solana Devnet",
    mgChain: "solana",
    rpcUrl: env.NEXT_PUBLIC_SOLANA_RPC_URL,
    usdcMint: env.NEXT_PUBLIC_SOLANA_USDC_MINT,
  },
};
