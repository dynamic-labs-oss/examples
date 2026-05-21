"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  X,
  TrendingUp,
  TrendingDown,
  Gift,
  Loader2,
  DollarSign,
  RefreshCw,
} from "lucide-react";
import { useUserPositions } from "@/lib/hooks/useUserPositions";
import { useKalshiTrading } from "@/lib/hooks/useKalshiTrading";
import { useWallet } from "@/lib/providers";
import { signTransaction } from "@dynamic-labs-sdk/solana";
import { dynamicClient } from "@/lib/dynamic";
import { VersionedTransaction } from "@solana/web3.js";
import type { Position } from "@/lib/types/market";
import { USDC_MINT } from "@/lib/constants";

interface PortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PortfolioModal({ isOpen, onClose }: PortfolioModalProps) {
  const { solanaAccount, loggedIn: isLoggedIn } = useWallet();
  const { positions, orders, isLoading, refetch } = useUserPositions();
  const { sellPosition } = useKalshiTrading();
  const [redeemingMint, setRedeemingMint] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [sellingMint, setSellingMint] = useState<string | null>(null);
  const [sellError, setSellError] = useState<string | null>(null);
  // Track success message per position by storing the mint that was sold
  const [soldMint, setSoldMint] = useState<string | null>(null);
  const [soldTxHash, setSoldTxHash] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSell = async (position: Position) => {
    if (!solanaAccount) {
      setSellError("Please connect a wallet");
      return;
    }

    setSellingMint(position.outcomeMint);
    setSellError(null);
    setSoldMint(null);
    setSoldTxHash(null);

    try {
      const result = await sellPosition({
        marketId: position.marketId,
        tokenMint: position.outcomeMint,
        settlementMint: position.settlementMint,
        side: position.side,
        size: position.size,
      });

      if (result.success) {
        // Track which position was sold
        setSoldMint(position.outcomeMint);
        setSoldTxHash(result.txHash?.slice(0, 8) || null);
        setTimeout(() => {
          refetch();
          setSoldMint(null);
          setSoldTxHash(null);
        }, 3000);
      } else {
        setSellError(result.error || "Failed to sell position");
      }
    } catch (error) {
      setSellError(error instanceof Error ? error.message : "Failed to sell");
    } finally {
      setSellingMint(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleRedeem = async (position: Position) => {
    if (!solanaAccount) {
      setRedeemError("Please connect a Solana wallet");
      return;
    }

    setRedeemingMint(position.outcomeMint);
    setRedeemError(null);

    try {
      const walletAddress = solanaAccount.address;
      const settlementMint = position.settlementMint || USDC_MINT;

      // Outcome tokens have 6 decimals, so multiply by 1,000,000
      const amount = Math.floor(position.size * 1_000_000);

      // Request redemption order from DFlow Trade API
      const queryParams = new URLSearchParams();
      queryParams.append("endpoint", "order");
      queryParams.append("userPublicKey", walletAddress);
      queryParams.append("inputMint", position.outcomeMint);
      queryParams.append("outputMint", settlementMint);
      queryParams.append("amount", amount.toString());

      const orderResponse = await fetch(`/api/dflow?${queryParams.toString()}`);

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.error || "Failed to create redemption order");
      }

      const orderData = await orderResponse.json();

      // Deserialize and sign the transaction
      const transactionBuffer = Buffer.from(orderData.transaction, "base64");
      const transaction = VersionedTransaction.deserialize(transactionBuffer);

      const { signedTransaction } = await signTransaction(
        { walletAccount: solanaAccount, transaction },
        dynamicClient
      );

      // Get connection via RPC URL from env or fallback
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
      const { Connection } = await import("@solana/web3.js");
      const connection = new Connection(rpcUrl, "confirmed");

      const signature = await connection.sendRawTransaction(
        (signedTransaction as VersionedTransaction).serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        }
      );

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: transaction.message.recentBlockhash,
          lastValidBlockHeight: (
            await connection.getLatestBlockhash()
          ).lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error(
          `Redemption failed: ${JSON.stringify(confirmation.value.err)}`
        );
      }

      await refetch();
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : "Redemption failed");
    } finally {
      setRedeemingMint(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[#12131a] rounded-[16px] border border-[#262a34] z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#262a34]">
              <h2 className="font-['Clash_Display',sans-serif] text-xl font-bold text-white">
                Portfolio
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing || isLoading}
                  className="p-2 rounded-full hover:bg-[#252630] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh positions"
                >
                  <RefreshCw
                    className={`w-5 h-5 text-[rgba(221,226,246,0.6)] ${
                      isRefreshing ? "animate-spin" : ""
                    }`}
                  />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-[#252630] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-[rgba(221,226,246,0.6)]" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {!isLoggedIn ? (
                <div className="text-center py-8">
                  <p className="font-['Clash_Display',sans-serif] text-[rgba(221,226,246,0.5)]">
                    Connect your wallet to view your portfolio
                  </p>
                </div>
              ) : isLoading ? (
                <div className="text-center py-8">
                  <p className="font-['Clash_Display',sans-serif] text-[rgba(221,226,246,0.5)]">
                    Loading positions...
                  </p>
                </div>
              ) : positions.length === 0 && orders.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center">
                    <TrendingUp className="w-8 h-8 text-[#8b5cf6]" />
                  </div>
                  <p className="font-['Clash_Display',sans-serif] text-[rgba(221,226,246,0.5)] mb-2">
                    No positions yet
                  </p>
                  <p className="font-['Clash_Display',sans-serif] text-[rgba(221,226,246,0.3)] text-sm">
                    Start trading to build your portfolio
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Error message */}
                  {redeemError && (
                    <div className="mb-4 p-3 rounded-[8px] bg-[#ef4444]/10 border border-[#ef4444]/20">
                      <p className="font-['Clash_Display',sans-serif] text-[#ef4444] text-sm">
                        {redeemError}
                      </p>
                    </div>
                  )}

                  {/* Positions */}
                  {positions.length > 0 && (
                    <div>
                      <h3 className="font-['Clash_Display',sans-serif] text-sm font-semibold text-[rgba(221,226,246,0.5)] mb-3">
                        POSITIONS
                      </h3>
                      <div className="space-y-2">
                        {positions.map((position) => (
                          <div
                            key={position.outcomeMint || position.marketId}
                            className="p-4 rounded-[12px] bg-[#1a1b23] border border-[#262a34]"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-['Clash_Display',sans-serif] text-white font-medium text-sm truncate max-w-[200px]">
                                {position.question}
                              </span>
                              <div className="flex items-center gap-2">
                                {/* Market status badge */}
                                {position.marketStatus &&
                                  position.marketStatus !== "open" && (
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                        position.marketStatus ===
                                          "determined" ||
                                        position.marketStatus === "finalized"
                                          ? "bg-[#8b5cf6]/20 text-[#8b5cf6]"
                                          : "bg-[#64748b]/20 text-[#64748b]"
                                      }`}
                                    >
                                      {position.marketStatus.toUpperCase()}
                                    </span>
                                  )}
                                {/* Side badge */}
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    position.side === "yes"
                                      ? "bg-[#14b8a6]/20 text-[#14b8a6]"
                                      : "bg-[#ef4444]/20 text-[#ef4444]"
                                  }`}
                                >
                                  {position.side.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-['Clash_Display',sans-serif] text-[rgba(221,226,246,0.5)] text-sm">
                                {position.size.toFixed(2)} shares @{" "}
                                {position.avgPrice}¢
                              </span>
                              <div className="flex items-center gap-1">
                                {position.pnl >= 0 ? (
                                  <TrendingUp className="w-4 h-4 text-[#14b8a6]" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-[#ef4444]" />
                                )}
                                <span
                                  className={`font-['Clash_Display',sans-serif] text-sm font-semibold ${
                                    position.pnl >= 0
                                      ? "text-[#14b8a6]"
                                      : "text-[#ef4444]"
                                  }`}
                                >
                                  {position.pnl >= 0 ? "+" : ""}$
                                  {position.pnl.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {/* Redemption section */}
                            {position.isRedeemable && (
                              <div className="mt-3 pt-3 border-t border-[#262a34]">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Gift className="w-4 h-4 text-[#14b8a6]" />
                                    <span className="font-['Clash_Display',sans-serif] text-[#14b8a6] text-sm font-medium">
                                      {position.result === position.side
                                        ? "You won! Redeem your winnings"
                                        : position.scalarOutcomePct !==
                                          undefined
                                        ? `Partial payout: ${
                                            position.side === "yes"
                                              ? (
                                                  position.scalarOutcomePct /
                                                  100
                                                ).toFixed(0)
                                              : (
                                                  (10000 -
                                                    position.scalarOutcomePct) /
                                                  100
                                                ).toFixed(0)
                                          }%`
                                        : "Redeemable"}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleRedeem(position)}
                                    disabled={
                                      redeemingMint === position.outcomeMint
                                    }
                                    className="px-3 py-1.5 rounded-[8px] bg-[#14b8a6] hover:bg-[#0d9488] disabled:bg-[#14b8a6]/50 disabled:cursor-not-allowed text-white font-['Clash_Display',sans-serif] text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                                  >
                                    {redeemingMint === position.outcomeMint ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Redeeming...
                                      </>
                                    ) : (
                                      "Redeem"
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Sell button for active markets */}
                            {position.marketStatus === "open" ||
                            position.marketStatus === "active" ||
                            (!position.isRedeemable &&
                              position.redemptionStatus !== "open") ? (
                              <div className="mt-3 pt-3 border-t border-[#262a34]">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-[#8b5cf6]" />
                                    <span className="font-['Clash_Display',sans-serif] text-[rgba(221,226,246,0.7)] text-sm">
                                      Sell your position
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleSell(position)}
                                    disabled={
                                      sellingMint === position.outcomeMint ||
                                      sellingMint !== null
                                    }
                                    className="px-3 py-1.5 rounded-[8px] bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:bg-[#8b5cf6]/50 disabled:cursor-not-allowed text-white font-['Clash_Display',sans-serif] text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                                  >
                                    {sellingMint === position.outcomeMint ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Selling...
                                      </>
                                    ) : (
                                      "Sell"
                                    )}
                                  </button>
                                </div>
                                {sellError &&
                                  sellingMint === position.outcomeMint && (
                                    <p className="mt-2 text-[#ef4444] text-xs font-['Clash_Display',sans-serif]">
                                      {sellError}
                                    </p>
                                  )}
                                {soldMint === position.outcomeMint &&
                                  soldTxHash && (
                                    <p className="mt-2 text-[#14b8a6] text-xs font-['Clash_Display',sans-serif]">
                                      Sold! TX: {soldTxHash}...
                                    </p>
                                  )}
                              </div>
                            ) : null}

                            {/* Pending redemption indicator */}
                            {position.redemptionStatus === "pending" &&
                              !position.isRedeemable &&
                              position.marketStatus !== "open" &&
                              position.marketStatus !== "active" && (
                                <div className="mt-3 pt-3 border-t border-[#262a34]">
                                  <span className="font-['Clash_Display',sans-serif] text-[rgba(221,226,246,0.5)] text-sm">
                                    Redemption pending - awaiting market
                                    settlement
                                  </span>
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active Orders */}
                  {orders.length > 0 && (
                    <div>
                      <h3 className="font-['Clash_Display',sans-serif] text-sm font-semibold text-[rgba(221,226,246,0.5)] mb-3">
                        ACTIVE ORDERS
                      </h3>
                      <div className="space-y-2">
                        {orders.map((order) => (
                          <div
                            key={order.id}
                            className="p-4 rounded-[12px] bg-[#1a1b23] border border-[#262a34]"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-['Clash_Display',sans-serif] text-white font-medium text-sm">
                                {order.ticker}
                              </span>
                              <span className="font-['Clash_Display',sans-serif] text-[#f59e0b] text-xs font-semibold px-2 py-1 rounded-full bg-[#f59e0b]/20">
                                {order.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-['Clash_Display',sans-serif] text-[rgba(221,226,246,0.5)] text-sm">
                                {order.side.toUpperCase()} {order.size} @{" "}
                                {order.price}¢
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
