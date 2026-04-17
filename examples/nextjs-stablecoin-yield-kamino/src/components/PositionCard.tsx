"use client";

import type { UserPosition, EnrichedVault } from "@/lib/types";
import { formatAPY, formatTokenAmount, formatUSD, shortenAddress } from "@/lib/utils";
import { ExternalLink, TrendingUp } from "lucide-react";

interface PositionCardProps {
  position: UserPosition;
  vault?: EnrichedVault;
  isOperating: boolean;
  onWithdraw: (vaultAddress: string, shares: number) => void;
}

export function PositionCard({
  position,
  vault,
  isOperating,
  onWithdraw,
}: PositionCardProps) {
  const tokenSymbol = vault?.tokenSymbol ?? "tokens";
  const tokenName = vault?.tokenName ?? "Unknown Token";
  const decimals = vault?.decimals ?? 6;
  const m = vault?.metrics;
  const displayApy = m ? (m.apy30d > 0 ? m.apy30d : m.apy) : 0;

  return (
    <div
      className="bg-white rounded-xl flex flex-col"
      style={{ border: "1px solid #DADADA" }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: "#DADADA" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#606060] uppercase tracking-wide">{tokenName}</p>
            <h3 className="text-base font-semibold text-[#030303] mt-0.5">{tokenSymbol}</h3>
            <a
              href={`https://app.kamino.finance/liquidity/${position.vaultAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#606060] hover:text-[#4779FF] mt-0.5 transition-colors"
            >
              {shortenAddress(position.vaultAddress)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          {displayApy > 0 && (
            <div
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold"
              style={{ background: "#E8F0FE", color: "#1967D2" }}
            >
              <TrendingUp className="h-3 w-3" />
              {formatAPY(displayApy)}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 space-y-3 flex-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-medium text-[#606060] uppercase tracking-wide">Balance</p>
            <p className="text-sm font-semibold text-[#030303] mt-0.5">
              {formatTokenAmount(position.tokenBalance, decimals)} {tokenSymbol}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-[#606060] uppercase tracking-wide">Value</p>
            <p className="text-sm font-semibold text-[#030303] mt-0.5">{formatUSD(position.usdValue)}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-[#606060] uppercase tracking-wide">Shares</p>
            <p className="text-sm font-semibold text-[#030303] mt-0.5">
              {formatTokenAmount(parseFloat(position.shares), 2)}
            </p>
          </div>
          {m?.tvlUsd ? (
            <div>
              <p className="text-[10px] font-medium text-[#606060] uppercase tracking-wide">Pool TVL</p>
              <p className="text-sm font-semibold text-[#030303] mt-0.5">{formatUSD(m.tvlUsd)}</p>
            </div>
          ) : null}
        </div>

        <button
          onClick={() => onWithdraw(position.vaultAddress, parseFloat(position.shares))}
          disabled={isOperating || parseFloat(position.shares) <= 0}
          className="w-full px-3 py-2 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderColor: "#EA580C", color: "#EA580C" }}
          onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = "#FFF7ED"; }}
          onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          {isOperating ? "Processing…" : "Withdraw All"}
        </button>
      </div>
    </div>
  );
}
