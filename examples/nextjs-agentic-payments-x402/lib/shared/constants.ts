/**
 * Network + token constants. Framework-agnostic (no Next imports) so this is
 * shared by the Next app, middleware, and the standalone agent.
 *
 * Network is configurable via X402_NETWORK ("base" | "base-sepolia"), defaulting
 * to **Base mainnet** for production. Set X402_NETWORK=base-sepolia for testnet dev.
 */
import { base, baseSepolia } from "viem/chains";
import type { Chain } from "viem";

export type X402Network = "base" | "base-sepolia";

export const X402_NETWORK: X402Network =
  process.env.X402_NETWORK === "base-sepolia" ? "base-sepolia" : "base";

interface NetConfig {
  chainId: number;
  networkId: string;
  usdc: `0x${string}`;
  viemChain: Chain;
  defaultRpc: string;
}

const NETWORKS: Record<X402Network, NetConfig> = {
  base: {
    chainId: 8453,
    networkId: "8453",
    // Circle USDC on Base mainnet
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    viemChain: base,
    defaultRpc: "https://mainnet.base.org",
  },
  "base-sepolia": {
    chainId: 84532,
    networkId: "84532",
    // Circle USDC on Base Sepolia
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    viemChain: baseSepolia,
    defaultRpc: "https://sepolia.base.org",
  },
};

const NET = NETWORKS[X402_NETWORK];

export const CHAIN_ID = NET.chainId;
export const NETWORK_ID = NET.networkId;
export const USDC_ADDRESS = NET.usdc;
export const USDC_DECIMALS = 6;
export const VIEM_CHAIN = NET.viemChain;
/** RPC for reads; override with BASE_RPC_URL. */
export const RPC_URL = process.env.BASE_RPC_URL || NET.defaultRpc;

/** The chain string Dynamic uses for EVM delegations (webhook `data.chain`). */
export const DELEGATION_CHAIN = "EVM";

/** Minimal ERC-20 ABI for reading a balance. */
export const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** Format a USDC base-unit amount (bigint) as a plain USD string, e.g. "12.50". */
export function formatUsd(baseUnits: bigint): string {
  const cents = baseUnits / BigInt(10 ** (USDC_DECIMALS - 2));
  return (Number(cents) / 100).toFixed(2);
}
