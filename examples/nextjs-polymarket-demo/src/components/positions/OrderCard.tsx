"use client";

import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { PolymarketOrder } from "@/lib/hooks/useActiveOrders";

interface OrderCardProps {
  order: PolymarketOrder;
  onCancel?: (orderId: string) => void;
  isCancelling?: boolean;
}

function formatCurrency(value: number, decimals = 2): string {
  return `$${value.toFixed(decimals)}`;
}

function formatPrice(price: number): string {
  return `${Math.round(price * 100)}¢`;
}

export function OrderCard({
  order,
  onCancel,
  isCancelling = false,
}: OrderCardProps) {
  // Fetch market info to display the question
  const { data: marketInfo } = useQuery({
    queryKey: ["market-info", order.asset_id],
    queryFn: async () => {
      try {
        const response = await fetch(
          `/api/polymarket/market-by-token?tokenId=${order.asset_id}`
        );
        if (!response.ok) return null;
        return await response.json();
      } catch {
        return null;
      }
    },
    staleTime: 300000, // 5 minutes
  });

  const price = parseFloat(order.price);
  const shares = parseFloat(order.original_size);
  const matched = parseFloat(order.size_matched);
  const totalValue = shares * price;
  const isBuy = order.side === "BUY";

  const getOutcome = () => {
    if (!marketInfo?.outcomes || !marketInfo?.clobTokenIds) return null;
    try {
      const outcomes = JSON.parse(marketInfo.outcomes);
      const tokenIds = JSON.parse(marketInfo.clobTokenIds);
      const outcomeIndex = tokenIds.indexOf(order.asset_id);
      return outcomes[outcomeIndex] || outcomes[0];
    } catch {
      return null;
    }
  };

  const outcome = getOutcome();

  return (
    <div className="bg-white rounded-[16px] p-[16px] border border-[#DADADA] transition-all duration-200 hover:border-[#DADADA]">
      {/* Header with Market Title */}
      <div className="flex items-start justify-between gap-[12px] mb-[12px]">
        <div className="flex-1 min-w-0">
          {marketInfo ? (
            <h3 className="text-[14px] text-[#030303] leading-[1.3] line-clamp-2">
              {marketInfo.question || "Market"}
            </h3>
          ) : (
            <div className="h-[18px] bg-[#F0F0F0] rounded animate-pulse" />
          )}
          <div className="flex items-center gap-[6px] mt-[6px]">
            <span
              className={`px-[8px] py-[2px] rounded-[4px] text-[11px] ${
                isBuy
                  ? "bg-[rgba(62,163,75,0.12)] text-[#3ea34b]"
                  : "bg-[rgba(230,67,65,0.12)] text-[#e64341]"
              }`}
            >
              {order.side}
            </span>
            {outcome && (
              <span className="px-[8px] py-[2px] rounded-[4px] text-[11px] bg-[rgba(71,121,255,0.12)] text-[#4779FF]">
                {outcome}
              </span>
            )}
            <span className="px-[8px] py-[2px] rounded-[4px] text-[11px] bg-[rgba(245,158,11,0.12)] text-[#f59e0b]">
              {order.status}
            </span>
          </div>
        </div>
      </div>

      {/* Order Details */}
      <div className="grid grid-cols-3 gap-[8px] mb-[12px]">
        <div className="bg-[#F9F9F9] border border-[#DADADA] rounded-[8px] p-[10px]">
          <p className="text-[10px] text-[#606060] uppercase tracking-[0.5px] mb-[2px]">
            Price
          </p>
          <p className="text-[14px] text-[#030303]">
            {formatPrice(price)}
          </p>
        </div>
        <div className="bg-[#F9F9F9] border border-[#DADADA] rounded-[8px] p-[10px]">
          <p className="text-[10px] text-[#606060] uppercase tracking-[0.5px] mb-[2px]">
            Shares
          </p>
          <p className="text-[14px] text-[#030303]">
            {shares.toFixed(1)}
          </p>
        </div>
        <div className="bg-[#F9F9F9] border border-[#DADADA] rounded-[8px] p-[10px]">
          <p className="text-[10px] text-[#606060] uppercase tracking-[0.5px] mb-[2px]">
            Total
          </p>
          <p className="text-[14px] text-[#030303]">
            {formatCurrency(totalValue)}
          </p>
        </div>
      </div>

      {/* Fill Progress */}
      {matched > 0 && (
        <div className="mb-[12px]">
          <div className="flex justify-between items-center mb-[4px]">
            <span className="text-[11px] text-[#606060]">
              Fill Progress
            </span>
            <span className="text-[11px] text-[#030303]">
              {matched.toFixed(1)} / {shares.toFixed(1)} shares
            </span>
          </div>
          <div className="h-[4px] bg-[#F0F0F0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4779FF] rounded-full transition-all duration-300"
              style={{ width: `${(matched / shares) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Order ID and Time */}
      <div className="flex items-center justify-between text-[11px] text-[#606060] mb-[12px]">
        <span className="font-mono">ID: {order.id.slice(0, 12)}...</span>
        {order.created_at && (
          <span>{new Date(order.created_at * 1000).toLocaleString()}</span>
        )}
      </div>

      {/* Cancel Button */}
      <button
        type="button"
        onClick={() => onCancel?.(order.id)}
        disabled={isCancelling || !onCancel}
        className="w-full py-[10px] px-[16px] rounded-[10px] bg-[rgba(230,67,65,0.08)] hover:bg-[rgba(230,67,65,0.15)] disabled:bg-[rgba(230,67,65,0.04)] border border-[rgba(230,67,65,0.25)] disabled:border-[rgba(230,67,65,0.12)] text-[#e64341] disabled:text-[rgba(230,67,65,0.4)] text-[13px] transition-all duration-150 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-[8px]"
      >
        {isCancelling ? (
          <>
            <Loader2 className="w-[14px] h-[14px] animate-spin" />
            Cancelling...
          </>
        ) : (
          "Cancel Order"
        )}
      </button>
    </div>
  );
}
