import { useState, useEffect } from "react";
import { useChainId } from "wagmi";
import { getApiForChain } from "../constants";

export interface Vault {
  id: string;
  address: string;
  name: string;
  symbol: string;
  asset: string;
  assetAddress: string;
  assetDecimals: number;
  apy: string;
  netApy: string;
  tvl: string;
  description: string;
  whitelisted: boolean;
  totalSupply: string;
  sharePrice: string;
  rewards: Reward[];
}

export interface Reward {
  asset: string;
  supplyApr: string;
  yearlySupplyTokens: string;
}

export type SortOption =
  | "netApy-desc"
  | "apy-desc"
  | "tvl-desc"
  | "whitelisted-desc"
  | "totalSupply-desc"
  | "name-asc";

// Vaults pinned to the top regardless of sort order.
// The Sentora PYUSD vault is Dynamic's featured Morpho integration.
const FEATURED_VAULT_NAMES = ["Sentora PYUSD Main"];

interface VaultApiResponse {
  id: string;
  address: string;
  name: string;
  symbol: string;
  whitelisted: boolean;
  asset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  state: {
    totalAssets: string;
    totalAssetsUsd: number;
    totalSupply: string;
    avgNetApy: number;
    allTimeApy: number;
    apy: number;
    netApy: number;
    netApyWithoutRewards: number;
    sharePrice: string;
    sharePriceUsd: number;
    rewards: Array<{
      asset: {
        address: string;
        symbol: string;
      };
      supplyApr: number;
      yearlySupplyTokens: string;
    }>;
  };
}

export function useVaultsList(sortBy: SortOption = "netApy-desc") {
  const chainId = useChainId();
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to parse numeric values from formatted strings
  const parseNumericValue = (value: string): number => {
    if (value === "N/A") return 0;
    // Remove % and $ symbols and parse
    const cleanValue = value.replace(/[%$,]/g, "");
    const num = parseFloat(cleanValue);
    return isNaN(num) ? 0 : num;
  };

  // Helper function to parse TVL (handles "M" suffix)
  const parseTVL = (tvl: string): number => {
    if (tvl === "N/A") return 0;
    const cleanValue = tvl.replace(/[$,]/g, "");
    if (cleanValue.includes("M")) {
      return parseFloat(cleanValue.replace("M", "")) * 1e6;
    }
    return parseFloat(cleanValue) || 0;
  };

  useEffect(() => {
    // Sorting function — featured vaults are always pinned to the top.
    const sortVaults = (vaultsToSort: Vault[]): Vault[] => {
      const featured = vaultsToSort.filter((v) =>
        FEATURED_VAULT_NAMES.includes(v.name)
      );
      const rest = vaultsToSort.filter(
        (v) => !FEATURED_VAULT_NAMES.includes(v.name)
      );

      const sortedRest = [...rest].sort((a, b) => {
        switch (sortBy) {
          case "netApy-desc":
            return parseNumericValue(b.netApy) - parseNumericValue(a.netApy);

          case "apy-desc":
            return parseNumericValue(b.apy) - parseNumericValue(a.apy);

          case "tvl-desc":
            return parseTVL(b.tvl) - parseTVL(a.tvl);

          case "whitelisted-desc":
            // Sort whitelisted vaults first, then by net APY
            if (a.whitelisted !== b.whitelisted) {
              return a.whitelisted ? -1 : 1;
            }
            return parseNumericValue(b.netApy) - parseNumericValue(a.netApy);

          case "totalSupply-desc":
            return (
              parseNumericValue(b.totalSupply) -
              parseNumericValue(a.totalSupply)
            );

          case "name-asc":
            return a.name.localeCompare(b.name);

          default:
            return parseNumericValue(b.netApy) - parseNumericValue(a.netApy);
        }
      });

      return [...featured, ...sortedRest];
    };

    async function fetchVaults() {
      try {
        setLoading(true);
        setError(null);

        const api = getApiForChain(chainId);
        if (!api?.morphoGraphql) {
          throw new Error("API endpoint not available for this network");
        }

        const res = await fetch(api.morphoGraphql, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `query GetVaults($chainId: Int!) {
              vaults(where: {chainId_in: [$chainId]}) {
                items {
                  id
                  address
                  name
                  symbol
                  whitelisted
                  asset {
                    address
                    symbol
                    decimals
                  }
                  state {
                    totalAssets
                    totalAssetsUsd
                    totalSupply
                    avgNetApy
                    allTimeApy
                    apy
                    netApy
                    netApyWithoutRewards
                    sharePrice
                    sharePriceUsd
                    rewards {
                      asset {
                        address
                        symbol
                      }
                      supplyApr
                      yearlySupplyTokens
                    }
                  }
                }
              }
            }`,
            variables: {
              chainId: chainId,
            },
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const json = await res.json();
        const vaultItems: VaultApiResponse[] = json?.data?.vaults?.items || [];

        const formattedVaults: Vault[] = vaultItems.map(
          (vault: VaultApiResponse) => {
            // Format APY values
            const apy = vault.state?.apy
              ? `${(vault.state.apy * 100).toFixed(2)}%`
              : "N/A";

            const netApy = vault.state?.netApy
              ? `${(vault.state.netApy * 100).toFixed(2)}%`
              : apy; // Fallback to regular APY if net APY not available

            // Format TVL
            const tvl = vault.state?.totalAssetsUsd
              ? `$${(vault.state.totalAssetsUsd / 1e6).toFixed(1)}M`
              : "N/A";

            // Format total supply
            const totalSupply = vault.state?.totalSupply
              ? (Number(vault.state.totalSupply) / 1e18).toLocaleString(
                  undefined,
                  {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }
                )
              : "N/A";

            // Format share price
            const sharePrice = vault.state?.sharePriceUsd
              ? `$${vault.state.sharePriceUsd.toFixed(6)}`
              : "N/A";

            // Format rewards
            const rewards: Reward[] = (vault.state?.rewards || []).map(
              (reward) => ({
                asset: reward.asset?.symbol || "Unknown",
                supplyApr: reward.supplyApr
                  ? `${(reward.supplyApr * 100).toFixed(2)}%`
                  : "N/A",
                yearlySupplyTokens: reward.yearlySupplyTokens || "N/A",
              })
            );

            return {
              id: vault.id,
              address: vault.address,
              name: vault.name || `${vault.asset?.symbol || "Unknown"} Vault`,
              symbol: vault.symbol,
              asset: vault.asset?.symbol || "Unknown",
              assetAddress: vault.asset?.address || "",
              assetDecimals: vault.asset?.decimals || 18,
              apy,
              netApy,
              tvl,
              description: `Earn yield on ${
                vault.asset?.symbol || "Unknown"
              } deposits`,
              whitelisted: vault.whitelisted || false,
              totalSupply,
              sharePrice,
              rewards,
            };
          }
        );

        // Sort the vaults based on the provided sort option
        const sortedVaults = sortVaults(formattedVaults);
        setVaults(sortedVaults);
      } catch (err) {
        console.error("Error fetching vaults:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch vaults");
      } finally {
        setLoading(false);
      }
    }

    fetchVaults();
  }, [sortBy, chainId]); // sortVaults is now inside useEffect

  return { vaults, loading, error };
}
