import { useEffect, useState } from "react";
import { useChainId } from "wagmi";
import { getApiForChain } from "../constants";

export interface Market {
  id: string;
  name: string;
  description: string;
  loanToken: {
    address: string;
    symbol: string;
    decimals: number;
  };
  collateralToken: {
    address: string;
    symbol: string;
    decimals: number;
  };
  maxLtv: string;
  borrowRate: string;
  tvl: string;
  healthFactor?: string;
}

interface MarketApiResponse {
  id: string;
  loanAsset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  collateralAsset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  state: {
    borrowAssets: number;
    supplyAssets: number;
    borrowAssetsUsd: number;
    supplyAssetsUsd: number;
  };
}

interface GraphQLResponse {
  data?: {
    markets?: {
      items: MarketApiResponse[];
    };
  };
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

export function useMarketsList() {
  const chainId = useChainId();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMarkets() {
      try {
        setLoading(true);
        setError(null);

        const api = getApiForChain(chainId);
        if (!api?.morphoGraphql) {
          throw new Error("API endpoint not available for this network");
        }

        const query = `
          query GetMarkets($chainId: Int!) {
            markets(where: {chainId_in: [$chainId]}) {
              items {
                id
                loanAsset {
                  address
                  symbol
                  decimals
                }
                collateralAsset {
                  address
                  symbol
                  decimals
                }
                state {
                  borrowAssets
                  supplyAssets
                  borrowAssetsUsd
                  supplyAssetsUsd
                }
              }
            }
          }
        `;

        const response = await fetch(api.morphoGraphql, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            variables: {
              chainId: chainId,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: GraphQLResponse = await response.json();

        if (result.errors) {
          throw new Error(result.errors[0]?.message || "GraphQL error");
        }

        const marketItems: MarketApiResponse[] =
          result.data?.markets?.items || [];

        // Log the raw market data for debugging
        console.log("Raw market items from API:", marketItems);

        const validMarkets = marketItems.filter((market) => {
          // Filter out markets with missing or invalid asset data
          return (
            market.collateralAsset &&
            market.loanAsset &&
            market.collateralAsset.symbol &&
            market.loanAsset.symbol &&
            market.collateralAsset.address &&
            market.loanAsset.address
          );
        });

        console.log(
          `Filtered ${
            marketItems.length - validMarkets.length
          } invalid markets out of ${marketItems.length} total markets`
        );

        const formattedMarkets: Market[] = validMarkets.map((market) => {
          // Calculate TVL from supply assets
          const tvlUsd = market.state.supplyAssetsUsd;
          const tvlFormatted =
            tvlUsd >= 1000000
              ? `$${(tvlUsd / 1000000).toFixed(1)}M`
              : `$${(tvlUsd / 1000).toFixed(0)}K`;

          // Use default LTV since it's not available in the API
          // In a real implementation, this would come from the smart contract or another API
          const maxLtvPercent = "85";

          // Generate market name and description
          const marketName = `${market.collateralAsset!.symbol}/${
            market.loanAsset!.symbol
          } Market`;
          const marketDescription = `Borrow ${
            market.loanAsset!.symbol
          } against ${
            market.collateralAsset!.symbol
          } collateral with competitive rates`;

          // Mock borrow rate (in a real app, this would come from the API or be calculated)
          const borrowRate = "12.5%";

          return {
            id: market.id,
            name: marketName,
            description: marketDescription,
            loanToken: market.loanAsset!,
            collateralToken: market.collateralAsset!,
            maxLtv: `${maxLtvPercent}%`,
            borrowRate,
            tvl: tvlFormatted,
          };
        });

        setMarkets(formattedMarkets);
      } catch (err) {
        console.error("Error fetching markets:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch markets"
        );
        setMarkets([]);
      } finally {
        setLoading(false);
      }
    }

    fetchMarkets();
  }, [chainId]);

  return {
    markets,
    loading,
    error,
  };
}
