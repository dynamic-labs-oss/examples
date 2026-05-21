"use client";

import { useWallet } from "@/lib/providers";
import { RefreshCw, TrendingDown, TrendingUp, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserPositions, type PolymarketPosition } from "@/lib/hooks/useUserPositions";
import { useActiveOrders } from "@/lib/hooks/useActiveOrders";
import { usePolymarketTrading } from "@/lib/hooks/usePolymarketTrading";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PositionCard } from "./PositionCard";
import { OrderCard } from "./OrderCard";
import { SellModal } from "./SellModal";

interface PortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "positions" | "orders";
type FilterType = "all" | "active" | "redeemable";
type SortType = "value" | "pnl" | "size";

interface ConfirmAction {
  type: "redeem" | "cancel";
  position?: PolymarketPosition;
  orderId?: string;
}

export function PortfolioModal({ isOpen, onClose }: PortfolioModalProps) {
  const modalTitleId = useId();
  const { evmAccount } = useWallet();
  const walletAddress = evmAccount?.address;
  const queryClient = useQueryClient();
  const { showToast, updateToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>("positions");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("value");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [sellPosition, setSellPosition] = useState<PolymarketPosition | null>(null);
  const [processingAsset, setProcessingAsset] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  const {
    data: positions,
    isLoading: isLoadingPositions,
    error: positionsError,
    refetch: refetchPositions,
    isFetching: isFetchingPositions,
  } = useUserPositions(walletAddress);

  const {
    sellPosition: executeSellPosition,
    redeemPosition,
    cancelOrder,
    getClobClient,
    isSelling,
    isRedeeming,
    isCancelling,
  } = usePolymarketTrading();

  // Initialize CLOB client for orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clobClient, setClobClient] = useState<any>(null);

  useEffect(() => {
    if (isOpen && walletAddress && activeTab === "orders") {
      getClobClient().then(setClobClient);
    }
  }, [isOpen, walletAddress, activeTab, getClobClient]);

  const {
    data: orders,
    isLoading: isLoadingOrders,
    error: ordersError,
    refetch: refetchOrders,
    isFetching: isFetchingOrders,
  } = useActiveOrders(clobClient, walletAddress);

  const filteredAndSortedPositions = useMemo(() => {
    if (!positions) return [];

    let filtered = [...positions];

    // Apply filter
    switch (filter) {
      case "active":
        filtered = filtered.filter((p) => !p.redeemable && p.size > 0.01);
        break;
      case "redeemable":
        filtered = filtered.filter((p) => p.redeemable);
        break;
      default:
        filtered = filtered.filter((p) => p.size > 0.01);
    }

    // Apply sort
    switch (sortBy) {
      case "pnl":
        filtered.sort((a, b) => Math.abs(b.cashPnl) - Math.abs(a.cashPnl));
        break;
      case "size":
        filtered.sort((a, b) => b.size - a.size);
        break;
      default:
        filtered.sort((a, b) => b.currentValue - a.currentValue);
    }

    return filtered;
  }, [positions, filter, sortBy]);

  // Calculate portfolio summary
  const portfolioSummary = useMemo(() => {
    if (!positions || positions.length === 0) {
      return { totalValue: 0, totalPnl: 0, percentPnl: 0 };
    }

    const activePositions = positions.filter((p) => p.size > 0.01);
    const totalValue = activePositions.reduce(
      (sum, p) => sum + p.currentValue,
      0
    );
    const totalPnl = activePositions.reduce((sum, p) => sum + p.cashPnl, 0);
    const totalInitial = activePositions.reduce(
      (sum, p) => sum + p.initialValue,
      0
    );
    const percentPnl = totalInitial > 0 ? (totalPnl / totalInitial) * 100 : 0;

    return { totalValue, totalPnl, percentPnl };
  }, [positions]);

  const handleSellClick = useCallback((position: PolymarketPosition) => {
    setSellPosition(position);
  }, []);

  const handleRedeemClick = useCallback((position: PolymarketPosition) => {
    setConfirmAction({ type: "redeem", position });
  }, []);

  const handleCancelOrderClick = useCallback((orderId: string) => {
    setConfirmAction({ type: "cancel", orderId });
  }, []);

  const handleSellConfirm = useCallback(async (amount: number) => {
    if (!sellPosition) return;

    const position = sellPosition;
    setProcessingAsset(position.asset);

    const toastId = showToast({
      type: "loading",
      title: "Selling Position",
      message: `Selling ${amount.toFixed(1)} shares of ${position.outcome}...`,
    });

    const result = await executeSellPosition({
      tokenId: position.asset,
      size: amount,
      isMarketOrder: true,
      negRisk: position.negativeRisk,
    });

    if (result.success) {
      updateToast(toastId, {
        type: "success",
        title: "Position Sold",
        message: `Successfully sold ${amount.toFixed(1)} shares`,
      });
      queryClient.invalidateQueries({ queryKey: ["polymarket-positions"] });
      refetchPositions();
      setSellPosition(null);
    } else {
      updateToast(toastId, {
        type: "error",
        title: "Sell Failed",
        message: result.error || "Failed to sell position",
      });
    }

    setProcessingAsset(null);
  }, [sellPosition, executeSellPosition, showToast, updateToast, queryClient, refetchPositions]);

  const handleConfirm = useCallback(async () => {
    if (!confirmAction) return;

    const action = confirmAction;
    setConfirmAction(null);

    if (action.type === "redeem" && action.position) {
      const position = action.position;
      setProcessingAsset(position.asset);

      const toastId = showToast({
        type: "loading",
        title: "Redeeming Position",
        message: `Redeeming ${position.outcome} position...`,
      });

      const result = await redeemPosition({
        conditionId: position.conditionId,
        outcomeIndex: position.outcomeIndex,
      });

      if (result.success) {
        updateToast(toastId, {
          type: "success",
          title: "Position Redeemed",
          message: `Successfully redeemed ${position.currentValue.toFixed(2)} USDC`,
        });
        queryClient.invalidateQueries({ queryKey: ["polymarket-positions"] });
        refetchPositions();
      } else {
        updateToast(toastId, {
          type: "error",
          title: "Redeem Failed",
          message: result.error || "Failed to redeem position",
        });
      }

      setProcessingAsset(null);
    } else if (action.type === "cancel" && action.orderId) {
      const orderId = action.orderId;
      setCancellingOrderId(orderId);

      const toastId = showToast({
        type: "loading",
        title: "Cancelling Order",
        message: "Processing cancellation...",
      });

      const result = await cancelOrder(orderId);

      if (result.success) {
        updateToast(toastId, {
          type: "success",
          title: "Order Cancelled",
          message: "Your order has been cancelled",
        });
        queryClient.invalidateQueries({ queryKey: ["active-orders"] });
        refetchOrders();
      } else {
        updateToast(toastId, {
          type: "error",
          title: "Cancel Failed",
          message: result.error || "Failed to cancel order",
        });
      }

      setCancellingOrderId(null);
    }
  }, [
    confirmAction,
    redeemPosition,
    cancelOrder,
    showToast,
    updateToast,
    queryClient,
    refetchPositions,
    refetchOrders,
  ]);

  const handleRefresh = useCallback(() => {
    if (activeTab === "positions") {
      refetchPositions();
    } else {
      refetchOrders();
    }
  }, [activeTab, refetchPositions, refetchOrders]);

  if (!isOpen) return null;

  const isProfitable = portfolioSummary.totalPnl >= 0;
  const isFetching = activeTab === "positions" ? isFetchingPositions : isFetchingOrders;

  const getConfirmModalContent = () => {
    if (!confirmAction) return { title: "", message: "", variant: "warning" as const, confirmText: "Confirm" };

    switch (confirmAction.type) {
      case "redeem":
        return {
          title: "Redeem Position?",
          message: `Are you sure you want to redeem your "${confirmAction.position?.outcome}" position for approximately $${confirmAction.position?.currentValue.toFixed(2)}?`,
          variant: "info" as const,
          confirmText: "Redeem",
        };
      case "cancel":
        return {
          title: "Cancel Order?",
          message: "Are you sure you want to cancel this order?",
          variant: "warning" as const,
          confirmText: "Cancel Order",
        };
    }
  };

  const confirmModalContent = getConfirmModalContent();

  return (
    <>
      {/* Blur Overlay */}
      <button
        type="button"
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 border-0 p-0 cursor-pointer"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div
          className="bg-white border border-[#DADADA] rounded-[16px] w-full max-w-[520px] shadow-lg overflow-hidden pointer-events-auto my-auto max-h-[calc(100vh-2rem)] flex flex-col"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-[20px] py-[16px] border-b border-[#DADADA] shrink-0">
            <h2
              id={modalTitleId}
              className="text-[18px] text-[#030303]"
            >
              Portfolio
            </h2>
            <div className="flex items-center gap-[8px]">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isFetching}
                className={`w-[32px] h-[32px] flex items-center justify-center text-[#4779FF] hover:bg-[rgba(71,121,255,0.1)] rounded-[8px] transition-colors cursor-pointer ${
                  isFetching ? "animate-spin" : ""
                }`}
                aria-label="Refresh"
              >
                <RefreshCw className="w-[18px] h-[18px]" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-[32px] h-[32px] flex items-center justify-center text-[#606060] hover:text-[#4779FF] hover:bg-[rgba(71,121,255,0.1)] rounded-[8px] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-[20px] h-[20px]" strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#DADADA] px-[20px]">
            {(["positions", "orders"] as TabType[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-[16px] py-[12px] text-[14px] border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab
                    ? "text-[#4779FF] border-[#4779FF]"
                    : "text-[#606060] border-transparent hover:text-[#030303]"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === "orders" && orders && orders.length > 0 && (
                  <span className="ml-[6px] px-[6px] py-[1px] bg-[rgba(71,121,255,0.15)] text-[#4779FF] text-[11px] rounded-full">
                    {orders.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Portfolio Summary - Only show for positions tab */}
          {activeTab === "positions" && positions && positions.length > 0 && (
            <div className="px-[20px] py-[16px] border-b border-[#DADADA] bg-[#F9F9F9]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#606060] uppercase tracking-[0.5px] mb-[4px]">
                    Total Value
                  </p>
                  <p className="text-[24px] text-[#030303]">
                    ${portfolioSummary.totalValue.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-[#606060] uppercase tracking-[0.5px] mb-[4px]">
                    Total P&L
                  </p>
                  <div className="flex items-center gap-[6px] justify-end">
                    {isProfitable ? (
                      <TrendingUp className="w-[18px] h-[18px] text-[#3ea34b]" />
                    ) : (
                      <TrendingDown className="w-[18px] h-[18px] text-[#e64341]" />
                    )}
                    <span
                      className={`text-[20px] ${
                        isProfitable ? "text-[#3ea34b]" : "text-[#e64341]"
                      }`}
                    >
                      ${Math.abs(portfolioSummary.totalPnl).toFixed(2)}
                    </span>
                    <span
                      className={`text-[14px] ${
                        isProfitable
                          ? "text-[#3ea34b]"
                          : "text-[#e64341]"
                      }`}
                    >
                      ({isProfitable ? "+" : ""}
                      {portfolioSummary.percentPnl.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters - Only show for positions tab */}
          {activeTab === "positions" && (
            <div className="px-[20px] py-[12px] border-b border-[#DADADA] flex items-center justify-between gap-[12px]">
              {/* Filter Tabs */}
              <div className="flex gap-[8px]">
                {(["all", "active", "redeemable"] as FilterType[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`px-[12px] py-[6px] rounded-[8px] text-[12px] transition-colors cursor-pointer ${
                      filter === f
                        ? "bg-[#4779FF] text-white"
                        : "bg-[#F0F0F0] text-[#606060] hover:bg-[#EBEBEB]"
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="bg-white border border-[#DADADA] text-[#030303] text-[12px] px-[10px] py-[6px] rounded-[8px] outline-none cursor-pointer"
              >
                <option value="value">Sort by Value</option>
                <option value="pnl">Sort by P&L</option>
                <option value="size">Sort by Size</option>
              </select>
            </div>
          )}

          {/* Content */}
          <div className="overflow-y-auto flex-1 min-h-0 p-[16px]">
            {activeTab === "positions" ? (
              // Positions Tab Content
              isLoadingPositions ? (
                <div className="flex flex-col items-center justify-center py-[40px]">
                  <div className="w-[32px] h-[32px] border-2 border-[#4779FF] border-t-transparent rounded-full animate-spin mb-[12px]" />
                  <p className="text-[14px] text-[#606060]">
                    Loading positions...
                  </p>
                </div>
              ) : positionsError ? (
                <div className="flex flex-col items-center justify-center py-[40px]">
                  <p className="text-[14px] text-[#e64341] mb-[8px]">
                    Failed to load positions
                  </p>
                  <button
                    type="button"
                    onClick={() => refetchPositions()}
                    className="text-[#4779FF] text-[14px] hover:underline cursor-pointer"
                  >
                    Try again
                  </button>
                </div>
              ) : !positions || filteredAndSortedPositions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-[40px]">
                  <div className="w-[64px] h-[64px] rounded-full bg-[rgba(71,121,255,0.1)] flex items-center justify-center mb-[16px]">
                    <span className="text-[32px]">📊</span>
                  </div>
                  <p className="text-[16px] text-[#030303] mb-[4px]">
                    No Positions
                  </p>
                  <p className="text-[13px] text-[#606060] text-center">
                    {filter === "all"
                      ? "You don't have any positions yet. Start trading to see your positions here."
                      : filter === "active"
                        ? "You don't have any active positions."
                        : "You don't have any redeemable positions."}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-[12px]">
                  {filteredAndSortedPositions.map((position) => (
                    <PositionCard
                      key={`${position.conditionId}-${position.outcomeIndex}`}
                      position={position}
                      onSell={handleSellClick}
                      onRedeem={handleRedeemClick}
                      isSelling={processingAsset === position.asset && isSelling}
                      isRedeeming={processingAsset === position.asset && isRedeeming}
                      disabled={processingAsset !== null && processingAsset !== position.asset}
                    />
                  ))}
                </div>
              )
            ) : (
              // Orders Tab Content
              isLoadingOrders ? (
                <div className="flex flex-col items-center justify-center py-[40px]">
                  <div className="w-[32px] h-[32px] border-2 border-[#4779FF] border-t-transparent rounded-full animate-spin mb-[12px]" />
                  <p className="text-[14px] text-[#606060]">
                    Loading orders...
                  </p>
                </div>
              ) : ordersError ? (
                <div className="flex flex-col items-center justify-center py-[40px]">
                  <p className="text-[14px] text-[#e64341] mb-[8px]">
                    Failed to load orders
                  </p>
                  <button
                    type="button"
                    onClick={() => refetchOrders()}
                    className="text-[#4779FF] text-[14px] hover:underline cursor-pointer"
                  >
                    Try again
                  </button>
                </div>
              ) : !orders || orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-[40px]">
                  <div className="w-[64px] h-[64px] rounded-full bg-[rgba(71,121,255,0.1)] flex items-center justify-center mb-[16px]">
                    <span className="text-[32px]">📋</span>
                  </div>
                  <p className="text-[16px] text-[#030303] mb-[4px]">
                    No Open Orders
                  </p>
                  <p className="text-[13px] text-[#606060] text-center">
                    You don&apos;t have any pending orders.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-[12px]">
                  {orders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onCancel={handleCancelOrderClick}
                      isCancelling={cancellingOrderId === order.id}
                    />
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Sell Modal */}
      <SellModal
        isOpen={!!sellPosition}
        onClose={() => setSellPosition(null)}
        onConfirm={handleSellConfirm}
        position={sellPosition}
        isLoading={isSelling}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={confirmModalContent.title}
        message={confirmModalContent.message}
        confirmText={confirmModalContent.confirmText}
        variant={confirmModalContent.variant}
        isLoading={isRedeeming || isCancelling}
      />
    </>
  );
}
