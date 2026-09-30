"use client";

import { useState } from "react";
import { sdk } from "@/lib/vaultsFyi";
import { usePositions } from "@/lib/usePositions";
import { useExecuteAction } from "@/lib/useExecuteAction";
import { formatApy } from "@/lib/utils";
import { Card } from "./ui/card";

export function PositionsPanel({ userAddress }: { userAddress: string }) {
  const { data, isLoading, error, refetch } = usePositions(userAddress);
  const {
    running,
    step,
    hashes,
    error: execError,
    execute,
  } = useExecuteAction();
  const [redeeming, setRedeeming] = useState<string | null>(null);

  async function handleRedeem(p: NonNullable<typeof data>["data"][number]) {
    setRedeeming(p.vaultId);
    try {
      const { currentActionIndex, actions } = await sdk.getActions({
        path: {
          action: "redeem",
          userAddress,
          network: p.network.name,
          vaultId: p.vaultId,
        },
        query: { assetAddress: p.asset.address, all: true },
      });
      await execute(currentActionIndex, actions);
      await refetch();
    } finally {
      setRedeeming(null);
    }
  }

  return (
    <Card
      title="Your positions"
      subtitle="Read directly from on-chain state across every protocol vaults.fyi covers — including positions opened outside this app."
    >
      {isLoading && <p className="text-sm text-[#606060]">Loading…</p>}
      {error && (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      )}
      {data?.data.length === 0 && (
        <p className="text-sm text-[#606060]">No positions yet.</p>
      )}
      <div className="space-y-2">
        {data?.data.map((p) => (
          <div
            key={`${p.network.name}-${p.vaultId}`}
            className="flex items-center justify-between p-3 border border-[#DADADA] rounded"
          >
            <div className="text-left min-w-0">
              <div className="text-sm font-medium truncate">
                {p.protocol.name} · {p.name}
              </div>
              <div className="text-xs text-[#606060]">
                {p.network.name} · {p.lpToken?.balanceUsd ?? "?"} USD ·{" "}
                {formatApy(p.apy.total)} APY
              </div>
            </div>
            <button
              onClick={() => handleRedeem(p)}
              disabled={running || redeeming === p.vaultId}
              className="text-xs bg-[#F9F9F9] border border-[#DADADA] hover:bg-[#F0F0F0] px-3 py-2 rounded disabled:opacity-50"
            >
              {redeeming === p.vaultId
                ? `Withdrawing…${step ? ` (${step.current}/${step.total})` : ""}`
                : "Withdraw all"}
            </button>
          </div>
        ))}
      </div>
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
      {execError && <p className="mt-3 text-sm text-red-600">{execError}</p>}
    </Card>
  );
}
