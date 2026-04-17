import type { KaminoVault as KaminoVaultType, VaultMetrics, UserPosition } from "./types";

const KAMINO_API_BASE = "https://api.kamino.finance";

// ---------------------------------------------------------------------------
// REST API helpers — vault listing, APY/TVL metrics, and user positions.
// ---------------------------------------------------------------------------

export async function fetchVaults(): Promise<KaminoVaultType[]> {
  const res = await fetch(`${KAMINO_API_BASE}/kvaults/vaults`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Failed to fetch vaults: ${res.statusText}`);
  const vaults: KaminoVaultType[] = await res.json();

  // Filter to vaults that have deployed funds, then sort by AUM descending
  // so the largest / most active vaults appear first.
  return vaults
    .filter((v) => {
      const aum = parseFloat(v.state.prevAum ?? "0");
      // Keep only vaults with meaningful AUM (> 1000 raw token units)
      return aum > 1000;
    })
    .sort((a, b) => {
      const aumA = parseFloat(a.state.prevAum ?? "0");
      const aumB = parseFloat(b.state.prevAum ?? "0");
      return aumB - aumA;
    });
}

export async function fetchVaultMetrics(
  vaultAddress: string
): Promise<VaultMetrics> {
  const res = await fetch(
    `${KAMINO_API_BASE}/kvaults/vaults/${vaultAddress}/metrics`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) throw new Error(`Failed to fetch vault metrics: ${res.statusText}`);
  const d = await res.json();

  const tokensAvailableUsd = parseFloat(d.tokensAvailableUsd) || 0;
  const tokensInvestedUsd = parseFloat(d.tokensInvestedUsd) || 0;

  return {
    apy: parseFloat(d.apy) || 0,
    apy7d: parseFloat(d.apy7d) || 0,
    apy30d: parseFloat(d.apy30d) || 0,
    tvlUsd: tokensAvailableUsd + tokensInvestedUsd,
    tokenPrice: parseFloat(d.tokenPrice) || 0,
    numberOfHolders: d.numberOfHolders || 0,
    sharesIssued: d.sharesIssued || "0",
    cumulativeInterestEarnedUsd: parseFloat(d.cumulativeInterestEarnedUsd) || 0,
  };
}

export async function fetchUserPositions(
  userAddress: string
): Promise<UserPosition[]> {
  const res = await fetch(
    `${KAMINO_API_BASE}/kvaults/users/${userAddress}/positions`
  );
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Failed to fetch user positions: ${res.statusText}`);
  }
  const data = await res.json();
  const rows: Record<string, unknown>[] = Array.isArray(data) ? data : (data.positions ?? []);
  return rows.map((r) => ({
    vaultAddress: (r.vaultAddress ?? r.vault ?? "") as string,
    shares: String(r.totalShares ?? r.shares ?? "0"),
    tokenBalance: Number(r.tokenBalance ?? r.balance ?? 0),
    usdValue: Number(r.usdValue ?? r.balanceUsd ?? 0),
  }));
}

// SDK helpers — transaction building uses @kamino-finance/klend-sdk.
export { KaminoVault } from "@kamino-finance/klend-sdk";
