"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { ERC4626_ABI } from "@/lib/ABIs";
import { VaultPosition } from "@/lib/hooks/useVaultPositions";

interface PositionCardProps {
  position: VaultPosition;
  onWithdrawn?: () => void;
}

export function PositionCard({ position, onWithdrawn }: PositionCardProps) {
  const { vault, assetsFormatted } = position;
  const { address } = useAccount();
  const [txStatus, setTxStatus] = useState("");

  const { writeContract, isPending } = useWriteContract({
    mutation: {
      onSuccess: () => {
        setTxStatus("Withdraw sent!");
        onWithdrawn?.();
      },
      onError: (e) => setTxStatus(`Failed: ${e.message.split("\n")[0]}`),
    },
  });

  const handleWithdrawAll = () => {
    if (!address) return;
    writeContract({
      address: vault.address as `0x${string}`,
      abi: ERC4626_ABI,
      functionName: "withdraw",
      args: [parseUnits(assetsFormatted, vault.assetDecimals), address, address],
    });
  };

  return (
    <div className="bg-white rounded-xl flex flex-col" style={{ border: "1px solid #DADADA" }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: "#DADADA" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-earn-text-secondary uppercase tracking-wide font-medium">{vault.asset}</p>
            <h3 className="text-base font-semibold text-earn-text-primary mt-0.5 truncate">{vault.name}</h3>
          </div>
          <div
            className="shrink-0 px-2 py-1 rounded-md text-xs font-semibold"
            style={{ background: "#E8F0FE", color: "#1967D2" }}
          >
            {vault.netApy} APY
          </div>
        </div>
      </div>

      {/* Stats + action */}
      <div className="p-4 space-y-3 flex-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-medium text-earn-text-secondary uppercase tracking-wide">Deposited</p>
            <p className="text-sm font-semibold text-earn-text-primary mt-0.5">
              {parseFloat(assetsFormatted).toFixed(4)} {vault.asset}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-earn-text-secondary uppercase tracking-wide">TVL</p>
            <p className="text-sm font-semibold text-earn-text-primary mt-0.5">{vault.tvl}</p>
          </div>
        </div>

        {txStatus && (
          <p className={`text-xs ${txStatus.startsWith("Failed") ? "text-red-500" : "text-green-600"}`}>
            {txStatus}
          </p>
        )}

        <button
          onClick={handleWithdrawAll}
          disabled={isPending}
          className="w-full px-3 py-2 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderColor: "#EA580C", color: "#EA580C" }}
          onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = "#FFF7ED"; }}
          onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          {isPending ? "Processing…" : "Withdraw All"}
        </button>
      </div>
    </div>
  );
}
