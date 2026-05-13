import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useChainId } from "wagmi";
import { getApiForChain, getDecimalsForChain } from "../constants";

interface MarketsData {
  borrowed: string | null;
  supplied: string | null;
  borrowedUsd: string | null;
  suppliedUsd: string | null;
  collateral: string | null;
  collateralUsd: string | null;
  healthFactor: string | null;
}

// GraphQL types for Morpho API
interface MarketPosition {
  id: string;
  user: {
    id: string;
  };
  market: {
    id: string;
    loanToken?: {
      id: string;
      symbol: string;
      decimals: number;
    };
    collateralToken?: {
      id: string;
      symbol: string;
      decimals: number;
    };
  };
  state: {
    borrowAssets: number;
    borrowAssetsUsd: number;
    supplyAssets: number;
    supplyAssetsUsd: number;
    collateral: number;
    collateralUsd: number;
  };
}

interface GraphQLResponse {
  data?: {
    marketPositions?: {
      items: MarketPosition[];
    };
  };
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

export function useMarketsData(address: string | undefined): MarketsData {
  const chainId = useChainId();
  const [borrowed, setBorrowed] = useState<string | null>(null);
  const [supplied, setSupplied] = useState<string | null>(null);
  const [borrowedUsd, setBorrowedUsd] = useState<string | null>(null);
  const [suppliedUsd, setSuppliedUsd] = useState<string | null>(null);
  const [collateral, setCollateral] = useState<string | null>(null);
  const [collateralUsd, setCollateralUsd] = useState<string | null>(null);
  const [healthFactor, setHealthFactor] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserPosition() {
      if (!address) {
        return;
      }

      try {
        const query = `
          query GetMarketPositions($chainId: Int!, $userAddress: String!) {
            marketPositions(
              where: {
                chainId_in: [$chainId], 
                userAddress_in: [$userAddress]
              }
            ) {
              items {
                id
                user { id }
                market {
                  id
                }
                state {
                  borrowAssets
                  borrowAssetsUsd
                  supplyAssets
                  supplyAssetsUsd
                  collateral
                  collateralUsd
                }
              }
            }
          }
        `;

        const api = getApiForChain(chainId);
        if (!api?.morphoGraphql) {
          return;
        }
        const response = await fetch(api.morphoGraphql, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            variables: {
              chainId: chainId,
              userAddress: address,
            },
          }),
        });

        const result: GraphQLResponse = await response.json();

        if (result.errors) {
          return;
        }

        const positions = result.data?.marketPositions?.items || [];
        const marketPosition = positions[0];

        if (marketPosition) {
          // Format the values - API returns numbers, so we need to convert to BigInt
          const decimals = getDecimalsForChain(chainId);
          if (!decimals?.weth) {
            return;
          }
          const borrowedAmount = formatUnits(
            BigInt(marketPosition.state.borrowAssets),
            decimals.weth
          );
          const suppliedAmount = formatUnits(
            BigInt(marketPosition.state.supplyAssets),
            6 // Collateral decimals
          );

          setBorrowed(borrowedAmount);
          setSupplied(suppliedAmount);
          setBorrowedUsd(`$${marketPosition.state.borrowAssetsUsd.toFixed(2)}`);
          setSuppliedUsd(`$${marketPosition.state.supplyAssetsUsd.toFixed(2)}`);

          // Format collateral amount
          const collateralAmount6 = formatUnits(
            BigInt(marketPosition.state.collateral),
            6
          );

          // Use the correct format - if 5000000 should be 5 collateral, use 6 decimals
          setCollateral(collateralAmount6);
          setCollateralUsd(`$${marketPosition.state.collateralUsd.toFixed(2)}`);

          // Calculate health factor using collateral
          const borrowedUsdValue = marketPosition.state.borrowAssetsUsd;
          const collateralUsdValue = marketPosition.state.collateralUsd;
          let healthFactor = null;

          if (collateralUsdValue > 0 && borrowedUsdValue > 0) {
            const ltv = borrowedUsdValue / collateralUsdValue;
            const maxLtv = 0.85; // 85% LTV
            healthFactor = (maxLtv / ltv).toFixed(2);
          }

          setHealthFactor(healthFactor);
        } else {
          setBorrowed(null);
          setSupplied(null);
          setBorrowedUsd(null);
          setSuppliedUsd(null);
          setCollateral(null);
          setCollateralUsd(null);
          setHealthFactor(null);
        }
      } catch {
        setBorrowed(null);
        setSupplied(null);
        setBorrowedUsd(null);
        setSuppliedUsd(null);
        setCollateral(null);
        setCollateralUsd(null);
        setHealthFactor(null);
      }
    }

    fetchUserPosition();
  }, [address, chainId]);

  return {
    borrowed,
    supplied,
    borrowedUsd,
    suppliedUsd,
    collateral,
    collateralUsd,
    healthFactor,
  };
}
