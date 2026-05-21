"use client";

import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/providers";
import type { Position, Order } from "@/lib/types/market";

interface PositionsResponse {
  positions: Position[];
  orders: Order[];
}

async function fetchPositions(
  walletAddress: string
): Promise<PositionsResponse> {
  const response = await fetch(
    `/api/kalshi/positions?wallet=${walletAddress}`
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to fetch positions");
  }

  return response.json();
}

export function useUserPositions() {
  const { solanaAccount } = useWallet();
  const address = solanaAccount?.address;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["user-positions", address],
    queryFn: () => fetchPositions(address!),
    enabled: !!address,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  return {
    positions: data?.positions || [],
    orders: data?.orders || [],
    isLoading,
    error,
    refetch,
  };
}
