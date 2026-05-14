"use client";

import { useMemo } from "react";
import type { Market } from "@/lib/hooks/usePolymarketMarkets";

interface MarketStatsProps {
  markets: Market[];
}

export function MarketStats({ markets }: MarketStatsProps) {
  const stats = useMemo(() => {
    if (markets.length === 0) {
      return {
        totalMarkets: 0,
        totalVolume: 0,
        totalTraders: 0,
        avgPriceDiff: 0,
      };
    }

    const totalVolume = markets.reduce((sum, m) => sum + (m.volume || 0), 0);
    const totalTraders = markets.reduce(
      (sum, m) => sum + (m.yesTraders || 0) + (m.noTraders || 0),
      0
    );
    const avgPriceDiff =
      markets.reduce((sum, m) => {
        const diff = Math.abs(parseFloat(m.yesPrice) - parseFloat(m.noPrice));
        return sum + diff;
      }, 0) / markets.length;

    return {
      totalMarkets: markets.length,
      totalVolume,
      totalTraders,
      avgPriceDiff: avgPriceDiff.toFixed(1),
    };
  }, [markets]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `$${(num / 1000).toFixed(1)}K`;
    }
    return `$${num.toFixed(0)}`;
  };

  return (
    <div className="pt-[16px] pb-[8px] grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white border border-[#DADADA] rounded-[12px] p-4 shadow-sm">
        <p className="font-medium text-[13px] text-[#606060] mb-1">
          Total Markets
        </p>
        <p className="font-bold text-[20px] text-[#030303]">
          {stats.totalMarkets}
        </p>
      </div>
      <div className="bg-white border border-[#DADADA] rounded-[12px] p-4 shadow-sm">
        <p className="font-medium text-[13px] text-[#606060] mb-1">
          Total Volume
        </p>
        <p className="font-bold text-[20px] text-[#030303]">
          {formatNumber(stats.totalVolume)}
        </p>
      </div>
      <div className="bg-white border border-[#DADADA] rounded-[12px] p-4 shadow-sm">
        <p className="font-medium text-[13px] text-[#606060] mb-1">
          Total Traders
        </p>
        <p className="font-bold text-[20px] text-[#030303]">
          {stats.totalTraders.toLocaleString()}
        </p>
      </div>
      <div className="bg-white border border-[#DADADA] rounded-[12px] p-4 shadow-sm">
        <p className="font-medium text-[13px] text-[#606060] mb-1">
          Avg Price Diff
        </p>
        <p className="font-bold text-[20px] text-[#030303]">
          {stats.avgPriceDiff}%
        </p>
      </div>
    </div>
  );
}
