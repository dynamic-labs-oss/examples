import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, erc20Abi, formatUnits } from "viem";
import { getNetworkConfigOrDefault } from "./networks";

export function useTokenBalance(
  userAddress: string | undefined,
  tokenAddress: string,
  chainId: number,
  decimals: number,
) {
  const network = getNetworkConfigOrDefault(chainId);

  return useQuery({
    queryKey: ["tokenBalance", userAddress, tokenAddress, chainId],
    enabled: !!userAddress,
    refetchInterval: 15_000,
    queryFn: async () => {
      const client = createPublicClient({
        chain: network.chain,
        transport: http(),
      });
      const raw = await client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [userAddress as `0x${string}`],
      });
      return {
        raw,
        formatted: formatUnits(raw, decimals),
      };
    },
  });
}
