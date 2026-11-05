import { useQuery } from "@tanstack/react-query";
import { sdk } from "./vaultsFyi";
import { getNetworkConfigOrDefault } from "./networks";

export type VaultOption = Awaited<
  ReturnType<typeof sdk.getAllVaults>
>["data"][number];

/**
 * Top USDC vaults on the active chain, ranked by 7-day APY, excluding any
 * with "complex" multi-step deposit/redeem flows for the first-deposit demo.
 *
 * Uses `/v2/detailed-vaults` (not `/v2/portfolio/best-deposit-options`) so
 * the recipe surfaces recommendations pre-login — no user address required.
 * Switch to `sdk.getBestDepositOptions({ path: { userAddress } })` if you
 * want personalized ranking once the user holds assets.
 *
 * Defaults that bite (verified against
 * https://api.vaults.fyi/v2/documentation/json):
 *   - `allowedNetworks` defaults to `[base, mainnet, arbitrum, optimism]`
 *     — silently excludes Polygon. We pass it explicitly per call.
 *   - `minTvl` defaults to 100000 USD.
 *   - `sortOrder` defaults to `asc` — without `desc` you get the WORST
 *     vaults first.
 *
 * Always pass these three explicitly.
 */
export function useDiscover(chainId: number) {
  const network = getNetworkConfigOrDefault(chainId);

  return useQuery({
    queryKey: ["discover", network.vaultsFyiKey],
    queryFn: async () => {
      const result = await sdk.getAllVaults({
        query: {
          allowedAssets: ["USDC"],
          allowedNetworks: [network.vaultsFyiKey],
          onlyTransactional: true,
          onlyAppFeatured: true,
          sortBy: "apy7day",
          sortOrder: "desc",
          perPage: 20,
        },
      });
      return result.data.filter(
        (v) =>
          v.transactionalProperties?.depositStepsType !== "complex" &&
          v.transactionalProperties?.redeemStepsType !== "complex",
      );
    },
  });
}
