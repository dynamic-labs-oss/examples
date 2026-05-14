"use client";

import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { ImageWithFallback } from "../ImageWithFallback";
import type { PolymarketPosition } from "@/lib/hooks/useUserPositions";

interface PositionCardProps {
  position: PolymarketPosition;
  onSell?: (position: PolymarketPosition) => void;
  onRedeem?: (position: PolymarketPosition) => void;
  isSelling?: boolean;
  isRedeeming?: boolean;
  disabled?: boolean;
}

function formatCurrency(value: number, decimals = 2): string {
  return `$${value.toFixed(decimals)}`;
}

function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatShares(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(1);
}

export function PositionCard({
  position,
  onSell,
  onRedeem,
  isSelling = false,
  isRedeeming = false,
  disabled = false,
}: PositionCardProps) {
  const isProfitable = position.cashPnl >= 0;
  const isRedeemable = position.redeemable;
  const isProcessing = isSelling || isRedeeming;

  return (
    <div
      className={`bg-white rounded-[16px] p-[16px] border transition-all duration-200 hover:border-[#DADADA] ${
        isRedeemable
          ? "border-[rgba(147,51,234,0.3)]"
          : "border-[#DADADA]"
      }`}
    >
      {/* Header with Title and Icon */}
      <div className="flex items-start gap-[12px] mb-[12px]">
        <div className="w-[48px] h-[48px] rounded-[8px] overflow-hidden shrink-0 bg-[#F0F0F0]">
          {position.icon ? (
            <ImageWithFallback
              src={position.icon}
              alt=""
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#2768FC] via-[#5483F0] to-[#9D4EDD]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] text-[#030303] leading-[1.3] line-clamp-2">
            {position.title}
          </h3>
          <div className="flex items-center gap-[6px] mt-[4px]">
            <span
              className={`px-[8px] py-[2px] rounded-[4px] text-[11px] ${
                position.outcome.toLowerCase() === "yes"
                  ? "bg-[rgba(62,163,75,0.12)] text-[#3ea34b]"
                  : "bg-[rgba(230,67,65,0.12)] text-[#e64341]"
              }`}
            >
              {position.outcome}
            </span>
            {isRedeemable && (
              <span className="px-[8px] py-[2px] rounded-[4px] text-[11px] bg-[rgba(147,51,234,0.12)] text-[#a855f7]">
                Redeemable
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-[8px] mb-[12px]">
        <div className="bg-[#F9F9F9] border border-[#DADADA] rounded-[8px] p-[10px]">
          <p className="text-[10px] text-[#606060] uppercase tracking-[0.5px] mb-[2px]">
            Shares
          </p>
          <p className="text-[14px] text-[#030303]">
            {formatShares(position.size)}
          </p>
        </div>
        <div className="bg-[#F9F9F9] border border-[#DADADA] rounded-[8px] p-[10px]">
          <p className="text-[10px] text-[#606060] uppercase tracking-[0.5px] mb-[2px]">
            Avg Price
          </p>
          <p className="text-[14px] text-[#030303]">
            {formatCurrency(position.avgPrice, 3)}
          </p>
        </div>
        <div className="bg-[#F9F9F9] border border-[#DADADA] rounded-[8px] p-[10px]">
          <p className="text-[10px] text-[#606060] uppercase tracking-[0.5px] mb-[2px]">
            Current
          </p>
          <p className="text-[14px] text-[#030303]">
            {formatCurrency(position.curPrice, 3)}
          </p>
        </div>
      </div>

      {/* Value and P&L Row */}
      <div className="flex items-center justify-between bg-[#F9F9F9] border border-[#DADADA] rounded-[8px] p-[12px] mb-[12px]">
        <div>
          <p className="text-[10px] text-[#606060] uppercase tracking-[0.5px] mb-[2px]">
            Current Value
          </p>
          <p className="text-[18px] text-[#030303]">
            {formatCurrency(position.currentValue)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[#606060] uppercase tracking-[0.5px] mb-[2px]">
            P&L
          </p>
          <div className="flex items-center gap-[4px] justify-end">
            {isProfitable ? (
              <TrendingUp className="w-[14px] h-[14px] text-[#3ea34b]" />
            ) : (
              <TrendingDown className="w-[14px] h-[14px] text-[#e64341]" />
            )}
            <span
              className={`text-[16px] ${
                isProfitable ? "text-[#3ea34b]" : "text-[#e64341]"
              }`}
            >
              {formatCurrency(Math.abs(position.cashPnl))}
            </span>
            <span
              className={`text-[12px] ${
                isProfitable
                  ? "text-[#3ea34b]"
                  : "text-[#e64341]"
              }`}
            >
              ({formatPercentage(position.percentPnl)})
            </span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      {isRedeemable ? (
        <button
          type="button"
          onClick={() => onRedeem?.(position)}
          disabled={isProcessing || disabled || !onRedeem}
          className="w-full py-[12px] px-[16px] rounded-[10px] bg-[#a855f7] hover:bg-[#9333ea] disabled:bg-[rgba(168,85,247,0.3)] disabled:cursor-not-allowed text-white disabled:text-[rgba(255,255,255,0.5)] text-[14px] transition-all duration-150 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-[8px]"
        >
          {isRedeeming ? (
            <>
              <Loader2 className="w-[16px] h-[16px] animate-spin" />
              Redeeming...
            </>
          ) : (
            "Redeem Position"
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onSell?.(position)}
          disabled={isProcessing || disabled || !onSell}
          className="w-full py-[12px] px-[16px] rounded-[10px] bg-[#e64341] hover:bg-[#c73533] disabled:bg-[rgba(230,67,65,0.3)] disabled:cursor-not-allowed text-white disabled:text-[rgba(255,255,255,0.5)] text-[14px] transition-all duration-150 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-[8px]"
        >
          {isSelling ? (
            <>
              <Loader2 className="w-[16px] h-[16px] animate-spin" />
              Selling...
            </>
          ) : (
            "Market Sell"
          )}
        </button>
      )}
    </div>
  );
}
