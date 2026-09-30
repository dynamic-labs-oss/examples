import {
  base,
  mainnet,
  arbitrum,
  optimism,
  polygon,
  type Chain,
} from "viem/chains";

/**
 * Networks supported by both Dynamic (EVM extension) and vaults.fyi.
 * Mirrors the SUPPORTED_NETWORKS pattern from the Dynamic Morpho recipe:
 * https://www.dynamic.xyz/docs/recipes/integrations/yield/morpho
 *
 * The `vaultsFyiKey` is the string the vaults.fyi API expects in path
 * params and query filters (e.g. `allowedNetworks: ["base"]`). It differs
 * from viem's chain.name in some cases (notably "mainnet" vs "ethereum"),
 * so we map explicitly rather than deriving.
 *
 * Type is narrowed to the literal union expected by the @vaultsfyi/sdk
 * `allowedNetworks` parameter so the values flow into SDK calls without
 * casts. Mirror of the enum from
 * https://api.vaults.fyi/v2/documentation/json (network names only —
 * CAIP-2 IDs accepted but not used here).
 */
export type VaultsFyiNetworkKey =
  | "mainnet"
  | "optimism"
  | "arbitrum"
  | "polygon"
  | "base";

export interface NetworkConfig {
  chainId: number;
  chain: Chain;
  displayName: string;
  vaultsFyiKey: VaultsFyiNetworkKey;
}

export const SUPPORTED_NETWORKS: Record<number, NetworkConfig> = {
  [base.id]: {
    chainId: base.id,
    chain: base,
    displayName: "Base",
    vaultsFyiKey: "base",
  },
  [mainnet.id]: {
    chainId: mainnet.id,
    chain: mainnet,
    displayName: "Ethereum",
    vaultsFyiKey: "mainnet",
  },
  [arbitrum.id]: {
    chainId: arbitrum.id,
    chain: arbitrum,
    displayName: "Arbitrum",
    vaultsFyiKey: "arbitrum",
  },
  [optimism.id]: {
    chainId: optimism.id,
    chain: optimism,
    displayName: "Optimism",
    vaultsFyiKey: "optimism",
  },
  [polygon.id]: {
    chainId: polygon.id,
    chain: polygon,
    displayName: "Polygon",
    vaultsFyiKey: "polygon",
  },
};

export const DEFAULT_CHAIN_ID = base.id;
export const SUPPORTED_CHAIN_IDS = Object.keys(SUPPORTED_NETWORKS).map(Number);
export const SUPPORTED_VAULTSFYI_KEYS: VaultsFyiNetworkKey[] = Object.values(
  SUPPORTED_NETWORKS,
).map((n) => n.vaultsFyiKey);

export function getNetworkConfig(chainId: number): NetworkConfig | undefined {
  return SUPPORTED_NETWORKS[chainId];
}

export function getNetworkConfigOrDefault(chainId: number): NetworkConfig {
  return SUPPORTED_NETWORKS[chainId] ?? SUPPORTED_NETWORKS[DEFAULT_CHAIN_ID];
}

export function isNetworkSupported(chainId: number): boolean {
  return chainId in SUPPORTED_NETWORKS;
}
