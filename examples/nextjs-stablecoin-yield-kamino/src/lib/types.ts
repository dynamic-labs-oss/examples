export interface KaminoVaultState {
  vaultAdminAuthority: string;
  baseVaultAuthority: string;
  baseVaultAuthorityBump: number;
  tokenMint: string;
  tokenMintDecimals?: number;
  sharesMint: string;
  sharesMintDecimals?: number;
  sharesIssued: string;
  tokenAvailable?: string;
  performanceFeeBps: number;
  managementFeeBps: number;
  vaultAllocationStrategy?: VaultAllocation[];
  prevAum?: string;
  cumulativeEarnedInterest?: string;
  name?: string;
  creationTimestamp?: number;
}

export interface VaultAllocation {
  reserve: string;
  targetAllocationWeight: number;
  tokenAllocationCap: string;
  ctokenAllocation: string;
}

export interface KaminoVault {
  address: string;
  state: KaminoVaultState;
  programId: string;
}

export interface VaultMetrics {
  apy: number;
  apy7d: number;
  apy30d: number;
  tvlUsd: number;
  tokenPrice: number;
  numberOfHolders: number;
  sharesIssued: string;
  cumulativeInterestEarnedUsd: number;
}

export interface UserPosition {
  vaultAddress: string;
  shares: string;
  tokenBalance: number;
  usdValue: number;
}

export interface EnrichedVault extends KaminoVault {
  metrics: VaultMetrics | null;
  tokenSymbol: string;
  tokenName: string;
  decimals: number;
}

export interface LastTransaction {
  type: "Deposit" | "Withdraw";
  hash: string;
  timestamp: number;
}
