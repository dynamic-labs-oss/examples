import { useQuery } from "@tanstack/react-query";
import { sdk } from "./vaultsFyi";

/**
 * Every vault position the user holds across every protocol vaults.fyi
 * indexes. Returns positions opened OUTSIDE this app too (Morpho-curated
 * Aave deposits, raw 4626 vaults, etc.) since vaults.fyi reads onchain.
 *
 * Endpoint: GET /v2/portfolio/positions/:userAddress
 */
export function usePositions(userAddress?: string) {
  return useQuery({
    queryKey: ["positions", userAddress],
    queryFn: () => sdk.getPositions({ path: { userAddress: userAddress! } }),
    enabled: !!userAddress,
  });
}
