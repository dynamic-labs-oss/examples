import { useQuery } from "@tanstack/react-query";
import { sdk } from "./vaultsFyi";

/**
 * Two-step rewards flow:
 *   1) GET /v2/transactions/rewards/context/:userAddress  → claim IDs by network
 *   2) GET /v2/transactions/rewards/claim/:userAddress?claimIds=[...]
 *      → ordered actions[] for the claim transactions
 *
 * This hook is step 1. The claim transactions are built on-demand in
 * RewardsPanel when the user clicks claim, via the same useExecuteAction
 * path the deposit/redeem flows use.
 */
export function useRewards(userAddress?: string) {
  return useQuery({
    queryKey: ["rewardsContext", userAddress],
    queryFn: () =>
      sdk.getRewardsTransactionsContext({
        path: { userAddress: userAddress! },
      }),
    enabled: !!userAddress,
  });
}
