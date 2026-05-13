import { useState, useEffect } from "react";
import { useChainId } from "wagmi";
import { getApiForChain } from "../constants";

export interface VaultDetail {
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
  totalAssets: string;
  totalAssetsUsd: number;
  curator: string;
  guardian: string;
  owner: string;
  fee: string;
  feeRecipient: string;
  timelock: string;
  creationTimestamp: string;
}

export interface Reward {
  asset: string;
  supplyApr: string;
  yearlySupplyTokens: string;
}

interface VaultDetailApiResponse {
  id: string;
  address: string;
  name: string;
  symbol: string;
  whitelisted: boolean;
  creationTimestamp: string;
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
    curator: string;
    guardian: string;
    owner: string;
    fee: number;
    feeRecipient: string;
    timelock: string;
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

export function useVaultDetail(vaultId: string | undefined) {
  const chainId = useChainId();
  const [vault, setVault] = useState<VaultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetching, setRefetching] = useState(false);

  useEffect(() => {
    async function fetchVaultDetail() {
      if (!vaultId) {
        setError("No vault ID provided");
        setLoading(false);
        return;
      }

      try {
        if (!vault) {
          setLoading(true);
        } else {
          setRefetching(true);
        }
        setError(null);

        const api = getApiForChain(chainId);
        if (!api?.morphoGraphql) {
          throw new Error("API endpoint not available for this network");
        }

        const res = await fetch(api.morphoGraphql, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `query GetVaultDetail($vaultId: String!) {
              vault(id: $vaultId) {
                id
                address
                name
                symbol
                whitelisted
                creationTimestamp
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
                  curator
                  guardian
                  owner
                  fee
                  feeRecipient
                  timelock
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
            }`,
            variables: {
              vaultId,
            },
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const json = await res.json();
        const vaultData: VaultDetailApiResponse = json?.data?.vault;

        if (!vaultData) {
          setError("Vault not found");
          setVault(null);
          return;
        }

        // Format APY values
        const apy = vaultData.state?.apy
          ? `${(vaultData.state.apy * 100).toFixed(2)}%`
          : "N/A";

        const netApy = vaultData.state?.netApy
          ? `${(vaultData.state.netApy * 100).toFixed(2)}%`
          : apy;

        // Format TVL
        const tvl = vaultData.state?.totalAssetsUsd
          ? `$${(vaultData.state.totalAssetsUsd / 1e6).toFixed(1)}M`
          : "N/A";

        // Format total supply
        const totalSupply = vaultData.state?.totalSupply
          ? (Number(vaultData.state.totalSupply) / 1e18).toLocaleString(
              undefined,
              {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }
            )
          : "N/A";

        // Format share price
        const sharePrice = vaultData.state?.sharePriceUsd
          ? `$${vaultData.state.sharePriceUsd.toFixed(6)}`
          : "N/A";

        // Format fee
        const fee = vaultData.state?.fee
          ? `${(vaultData.state.fee * 100).toFixed(2)}%`
          : "N/A";

        // Format timelock
        const timelock = vaultData.state?.timelock
          ? `${Number(vaultData.state.timelock)} seconds`
          : "N/A";

        // Format creation timestamp
        const creationTimestamp = vaultData.creationTimestamp
          ? new Date(
              Number(vaultData.creationTimestamp) * 1000
            ).toLocaleDateString()
          : "N/A";

        // Format rewards
        const rewards: Reward[] = (vaultData.state?.rewards || []).map(
          (reward) => ({
            asset: reward.asset?.symbol || "Unknown",
            supplyApr: reward.supplyApr
              ? `${(reward.supplyApr * 100).toFixed(2)}%`
              : "N/A",
            yearlySupplyTokens: reward.yearlySupplyTokens || "N/A",
          })
        );

        const formattedVault: VaultDetail = {
          id: vaultData.id,
          address: vaultData.address,
          name:
            vaultData.name || `${vaultData.asset?.symbol || "Unknown"} Vault`,
          symbol: vaultData.symbol,
          asset: vaultData.asset?.symbol || "Unknown",
          assetAddress: vaultData.asset?.address || "",
          assetDecimals: vaultData.asset?.decimals || 6,
          apy,
          netApy,
          tvl,
          description: `Earn yield on ${
            vaultData.asset?.symbol || "Unknown"
          } deposits`,
          whitelisted: vaultData.whitelisted || false,
          totalSupply,
          sharePrice,
          rewards,
          totalAssets: vaultData.state?.totalAssets || "0",
          totalAssetsUsd: vaultData.state?.totalAssetsUsd || 0,
          curator: vaultData.state?.curator || "N/A",
          guardian: vaultData.state?.guardian || "N/A",
          owner: vaultData.state?.owner || "N/A",
          fee,
          feeRecipient: vaultData.state?.feeRecipient || "N/A",
          timelock,
          creationTimestamp,
        };

        setVault(formattedVault);
      } catch (err) {
        console.error("Error fetching vault detail:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch vault details"
        );
        setVault(null);
      } finally {
        setLoading(false);
        setRefetching(false);
      }
    }

    fetchVaultDetail();
  }, [vaultId, chainId]);

  return { vault, loading, error, refetching };
}
