"use client";

import { useState } from "react";
import { sdk } from "@/lib/vaultsFyi";
import { useRewards } from "@/lib/useRewards";
import { useExecuteAction } from "@/lib/useExecuteAction";
import { useWallet } from "@/lib/providers";
import { getNetworkConfigOrDefault } from "@/lib/networks";
import { Card } from "./ui/card";

/**
 * Claimable rewards on the user's active network. vaults.fyi groups rewards
 * by network, so we scope to the chain the user has switched to in the
 * header. Multi-network claims would loop over additional networks the
 * user has rewards on; this recipe shows the single-network path for
 * clarity.
 */
export function RewardsPanel({ userAddress }: { userAddress: string }) {
  const { chainId } = useWallet();
  const network = getNetworkConfigOrDefault(chainId);
  const { data, isLoading, refetch } = useRewards(userAddress);
  const { running, step, hashes, error, execute } = useExecuteAction();
  const [preparing, setPreparing] = useState(false);

  // SDK types `claimable` and `getRewardsClaimActions` return as objects
  // with literal per-network keys (`mainnet`, `optimism`, etc.). The
  // active-chain lookup uses `vaultsFyiKey` (also a literal union), but
  // TS can't prove the key is present so we narrow via a Record cast.
  type ClaimableReward = NonNullable<
    typeof data
  >["claimable"]["mainnet"][number];
  type ClaimAction = Awaited<
    ReturnType<typeof sdk.getRewardsClaimActions>
  >["mainnet"];

  const claimableMap = (data?.claimable ?? {}) as unknown as Record<
    string,
    ClaimableReward[]
  >;
  const networkRewards: ClaimableReward[] =
    claimableMap[network.vaultsFyiKey] ?? [];
  const totalUsd = networkRewards.reduce(
    (sum, r) => sum + parseFloat(r.asset.claimableAmountInUsd ?? "0"),
    0,
  );

  async function handleClaim() {
    if (networkRewards.length === 0) return;
    setPreparing(true);
    try {
      const claimIds = networkRewards.map((r) => r.claimId);
      const claim = (await sdk.getRewardsClaimActions({
        path: { userAddress },
        query: { claimIds },
      })) as unknown as Record<string, ClaimAction | undefined>;
      const networkClaim = claim[network.vaultsFyiKey];
      if (!networkClaim || networkClaim.actions.length === 0) return;
      await execute(networkClaim.currentActionIndex, networkClaim.actions);
      await refetch();
    } finally {
      setPreparing(false);
    }
  }

  return (
    <Card
      title={`Claimable rewards on ${network.displayName}`}
      subtitle="Two-step flow: discover claim IDs from the rewards context endpoint, then sign the per-network claim transactions."
    >
      {isLoading && <p className="text-sm text-[#606060]">Loading…</p>}
      {!isLoading && networkRewards.length === 0 && (
        <p className="text-sm text-[#606060]">
          No claimable rewards on {network.displayName}.
        </p>
      )}
      {networkRewards.length > 0 && (
        <>
          <ul className="space-y-1 text-sm mb-4">
            {networkRewards.map((r) => (
              <li key={r.claimId}>
                {r.asset.claimableAmount} {r.asset.symbol}
                {r.asset.claimableAmountInUsd
                  ? ` (${r.asset.claimableAmountInUsd} USD)`
                  : ""}
                {" · "}
                <span className="text-[#606060]">
                  {r.sources.map((s) => s.protocol.name).join(", ")}
                </span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleClaim}
            disabled={preparing || running}
            className="bg-[#4779FF] text-white font-medium px-4 py-2 rounded hover:bg-[#3a66e0] disabled:opacity-50"
          >
            {preparing || running
              ? `Claiming…${step ? ` (${step.current}/${step.total})` : ""}`
              : `Claim ${totalUsd.toFixed(2)} USD`}
          </button>
        </>
      )}
      {hashes.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs">
          {hashes.map((h) => (
            <li key={h.hash}>
              <span className="font-mono">{h.hash}</span>{" "}
              <span className="text-[#606060]">({h.name})</span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Card>
  );
}
