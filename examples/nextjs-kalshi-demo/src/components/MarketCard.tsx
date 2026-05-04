"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import ClockIcon from "./ClockIcon";
import { ImageWithFallback } from "./ImageWithFallback";
import { useKalshiTrading } from "@/lib/hooks/useKalshiTrading";
import { useWallet } from "@/lib/providers";

interface MarketCardProps {
  question: string;
  timeRemaining: string;
  yesPrice: string;
  noPrice: string;
  category?: string;
  imageUrl?: string;
  yesTraders?: number;
  noTraders?: number;
  ticker?: string;
  yesTokenMint?: string;
  noTokenMint?: string;
  marketId?: string;
  tags?: string[];
}

const TAG_COLORS: Record<string, string> = {
  trending: "bg-[#8b5cf6]/20 text-[#8b5cf6] border-[#8b5cf6]/30",
  hot: "bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30",
  new: "bg-[#14b8a6]/20 text-[#14b8a6] border-[#14b8a6]/30",
  "ending soon": "bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30",
  "high stakes": "bg-[#ec4899]/20 text-[#ec4899] border-[#ec4899]/30",
  "close call": "bg-[#06b6d4]/20 text-[#06b6d4] border-[#06b6d4]/30",
};

export function MarketCard({
  question,
  timeRemaining,
  yesPrice,
  noPrice,
  imageUrl,
  yesTraders,
  noTraders,
  ticker,
  yesTokenMint,
  noTokenMint,
  marketId,
  tags = [],
}: MarketCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedOption, setSelectedOption] = useState<"yes" | "no" | null>(
    null
  );
  const [betAmount, setBetAmount] = useState<number>(0);
  const [betAmountInput, setBetAmountInput] = useState<string>("");
  const [tradingError, setTradingError] = useState<string | null>(null);
  const [tradingSuccess, setTradingSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const cardPosition = useRef<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);

  const { solanaAccount } = useWallet();
  const { placeOrder } = useKalshiTrading();

  const handleOptionClick = (option: "yes" | "no") => {
    if (!solanaAccount) {
      return;
    }

    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      cardPosition.current = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
      };
    }
    setSelectedOption(option);
    setIsExpanded(true);
    setBetAmount(0);
    setBetAmountInput("");
    setTradingError(null);
    setTradingSuccess(false);
  };

  const handleClose = useCallback(() => {
    setIsExpanded(false);
    setTimeout(() => {
      setSelectedOption(null);
      cardPosition.current = null;
      setTradingError(null);
      setTradingSuccess(false);
    }, 300);
  }, []);

  const handleQuickAdd = (amount: number) => {
    const newAmount = betAmount + amount;
    setBetAmount(newAmount);
    setBetAmountInput(newAmount === 0 ? "" : newAmount.toString());
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/\$/g, "");

    const parts = value.split(".");
    if (parts.length > 2) {
      value = parts[0] + "." + parts.slice(1).join("");
    }

    value = value.replace(/[^0-9.]/g, "");
    setBetAmountInput(value);

    if (value === "" || value === ".") {
      setBetAmount(0);
      return;
    }

    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setBetAmount(numValue);
    }
  };

  const handleBuy = useCallback(async () => {
    if (isSubmittingRef.current) return;
    if (betAmount === 0 || !selectedOption) return;

    if (!solanaAccount) {
      return;
    }

    if (!ticker) {
      setTradingError("Market data incomplete. Please try again.");
      return;
    }

    isSubmittingRef.current = true;
    setIsProcessing(true);
    setTradingError(null);
    setTradingSuccess(false);

    try {
      const tokenMint = selectedOption === "yes" ? yesTokenMint : noTokenMint;

      const result = await placeOrder({
        marketId: marketId || "",
        ticker: ticker || "",
        tokenMint: tokenMint || "",
        side: selectedOption,
        amount: betAmount,
        isMarketOrder: true,
      });

      if (result.success) {
        setTradingSuccess(true);
        setIsProcessing(false);
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        setIsProcessing(false);
        setTradingError(result.error || "Failed to place order");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setIsProcessing(false);
      setTradingError(errorMessage);
    } finally {
      isSubmittingRef.current = false;
    }
  }, [
    betAmount,
    selectedOption,
    solanaAccount,
    ticker,
    yesTokenMint,
    noTokenMint,
    marketId,
    placeOrder,
    handleClose,
  ]);

  const potentialWin =
    betAmount > 0
      ? selectedOption === "yes"
        ? (betAmount / parseFloat(yesPrice)) * 100
        : (betAmount / parseFloat(noPrice)) * 100
      : 0;

  const cardContent = (
    <motion.div
      layout
      className={`bg-[#12131a] rounded-[22.837px] w-full relative ${
        isExpanded ? "z-50" : "z-0"
      }`}
      style={
        isExpanded && cardPosition.current
          ? {
              position: "fixed",
              top: cardPosition.current.top,
              left: cardPosition.current.left,
              width: cardPosition.current.width,
            }
          : undefined
      }
    >
      <div className="content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] w-full">
        {/* Card Header */}
        <div className="bg-[#1a1b23] relative rounded-[22.837px] shrink-0 w-full">
          <div
            aria-hidden="true"
            className="absolute border-[#262a34] border-[0.571px] border-solid inset-0 pointer-events-none rounded-[22.837px] shadow-[0px_1.142px_2.284px_0px_rgba(0,0,0,0.02)]"
          />
          <div className="size-full">
            <div className="box-border content-stretch flex flex-col gap-[13.702px] items-start p-[15.986px] relative w-full">
              <div className="content-stretch flex gap-[9.135px] items-start relative shrink-0 w-full">
                {/* Image and Question */}
                <div className="basis-0 content-stretch flex flex-col gap-[9.135px] grow items-start min-h-px min-w-px relative shrink-0">
                  <div className="bg-linear-to-br from-[#8b5cf6]/20 to-[#06b6d4]/20 overflow-clip relative rounded-[7px] shrink-0 size-[45.675px]">
                    {imageUrl ? (
                      <ImageWithFallback
                        src={imageUrl}
                        alt="Market thumbnail"
                        className="absolute left-0 top-0 size-[45.675px] object-cover"
                        sizes="50px"
                      />
                    ) : (
                      <div className="absolute bg-linear-to-br from-[#8b5cf6]/30 to-[#06b6d4]/30 left-0 size-[45.675px] top-0 flex items-center justify-center">
                        <span className="text-lg">📊</span>
                      </div>
                    )}
                  </div>
                  <p
                    className={`font-['Clash_Display',sans-serif] leading-[22.837px] not-italic relative shrink-0 text-white text-[18.27px] tracking-[0.1827px] font-semibold ${
                      isExpanded ? "" : "line-clamp-2 h-[45.674px]"
                    }`}
                  >
                    {question}
                  </p>
                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-[6px] items-center">
                      {tags.slice(0, 3).map((tag) => {
                        const tagColor =
                          TAG_COLORS[tag] ||
                          "bg-[rgba(221,226,246,0.1)] text-[rgba(221,226,246,0.6)] border-[rgba(221,226,246,0.2)]";
                        return (
                          <span
                            key={tag}
                            className={`px-[6px] py-[2px] rounded-[12px] text-[11px] font-['Clash_Display',sans-serif] font-medium border ${tagColor}`}
                          >
                            {tag.charAt(0).toUpperCase() + tag.slice(1)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Timer */}
                <div className="content-stretch flex gap-[9.135px] h-[27.405px] items-center justify-end relative shrink-0 w-[80px]">
                  <div className="content-stretch flex gap-[4.567px] items-center overflow-clip relative shrink-0">
                    <ClockIcon />
                    <p className="font-['Clash_Display',sans-serif] leading-[18.27px] not-italic relative shrink-0 text-[13.702px] text-[rgba(221,226,246,0.5)] text-nowrap tracking-[0.137px] whitespace-pre font-medium">
                      {timeRemaining}
                    </p>
                  </div>
                </div>
              </div>

              {/* Price Chart Area */}
              {yesTraders !== undefined && noTraders !== undefined && (
                <div className="bg-[#1a1b23] h-[80px] relative rounded-[12px] shrink-0 w-full">
                  <div className="h-[80px] overflow-clip relative rounded-[inherit] w-full">
                    {/* Left Panel */}
                    <div className="absolute bg-[#1a1b23] bottom-0 box-border content-stretch flex flex-col items-start justify-between left-0 p-[8px] top-0 w-[100px]">
                      <div
                        aria-hidden="true"
                        className="absolute border-[#262a34] border-[0px_0.5px_0px_0px] border-solid inset-0 pointer-events-none"
                      />
                      <div className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-full">
                        {/* Yes Percentage */}
                        <div className="bg-[#14b8a6]/10 box-border content-stretch flex flex-col gap-[4px] h-[18px] items-center justify-center px-[8px] py-[6px] relative rounded-[20px] shrink-0 min-w-[51px]">
                          <div className="flex flex-col font-['Clash_Display',sans-serif] justify-center leading-0 not-italic relative shrink-0 text-[#14b8a6] text-[9px] text-nowrap font-semibold">
                            <p className="leading-[13px] whitespace-nowrap">
                              Yes {yesPrice}%
                            </p>
                          </div>
                        </div>
                        {/* No Percentage */}
                        <div className="bg-[#ef4444]/10 box-border content-stretch flex flex-col gap-[4px] h-[18px] items-center justify-center px-[8px] py-[6px] relative rounded-[20px] shrink-0 min-w-[42px]">
                          <div className="flex flex-col font-['Clash_Display',sans-serif] justify-center leading-0 not-italic relative shrink-0 text-[#ef4444] text-[9px] text-nowrap font-semibold">
                            <p className="leading-[13px] whitespace-nowrap">
                              No {noPrice}%
                            </p>
                          </div>
                        </div>
                      </div>
                      {/* Volume Display */}
                      <div className="flex flex-col font-['Clash_Display',sans-serif] justify-center leading-0 not-italic relative shrink-0 text-[#7b7f8d] text-[10px] text-nowrap font-medium">
                        <p className="leading-[13px] whitespace-pre">
                          ${((yesTraders + noTraders) * 234).toLocaleString()}{" "}
                          Vol.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className="absolute border-[#262a34] border-[0.5px] border-solid inset-0 pointer-events-none rounded-[12px]"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Yes/No Selection + Expanded Section */}
        <motion.div layout className="relative shrink-0 w-full">
          <div className="flex flex-col justify-center size-full">
            <div className="box-border content-stretch flex flex-col gap-[11px] items-start p-[13.702px] relative w-full">
              {/* Yes/No Buttons */}
              <div className="content-stretch flex gap-[4.567px] h-[41.107px] items-start relative shrink-0 w-full">
                {/* Yes Button */}
                <motion.button
                  onClick={() => handleOptionClick("yes")}
                  className={`basis-0 grow h-full min-h-px min-w-px relative rounded-[9.135px] shrink-0 cursor-pointer transition-all duration-150 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
                    selectedOption === "yes"
                      ? "bg-[#14b8a6]"
                      : "bg-[#14b8a6]/10 hover:bg-[#14b8a6]/20"
                  }`}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="flex flex-row items-center justify-center size-full">
                    <div className="box-border content-stretch flex gap-[22.837px] items-center justify-center px-[22.837px] py-[11.419px] relative size-full">
                      <div
                        className={`flex flex-col font-['Clash_Display',sans-serif] justify-center leading-0 not-italic relative shrink-0 text-[15.986px] text-nowrap text-right font-semibold ${
                          selectedOption === "yes"
                            ? "text-[#0a0b0f]"
                            : "text-[#14b8a6]"
                        }`}
                      >
                        <p className="leading-[28.547px] whitespace-pre">
                          Yes {yesPrice}¢
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.button>

                {/* No Button */}
                <motion.button
                  onClick={() => handleOptionClick("no")}
                  className={`basis-0 grow h-full min-h-px min-w-px relative rounded-[9.135px] shrink-0 cursor-pointer transition-all duration-150 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
                    selectedOption === "no"
                      ? "bg-[#ef4444]"
                      : "bg-[#ef4444]/10 hover:bg-[#ef4444]/20"
                  }`}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="flex flex-row items-center justify-center size-full">
                    <div className="box-border content-stretch flex gap-[22.837px] items-center justify-center px-[22.837px] py-[11.419px] relative size-full">
                      <div
                        className={`flex flex-col font-['Clash_Display',sans-serif] justify-center leading-0 not-italic relative shrink-0 text-[15.986px] text-nowrap text-right font-semibold ${
                          selectedOption === "no"
                            ? "text-white"
                            : "text-[#ef4444]"
                        }`}
                      >
                        <p className="leading-[28.547px] whitespace-pre">
                          No {noPrice}¢
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.button>
              </div>

              {/* Expanded Section */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      duration: 0.25,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                    className="overflow-hidden w-full"
                  >
                    <div className="content-stretch flex flex-col gap-[11px] items-start w-full">
                      {/* Input Field */}
                      <div className="bg-[#1a1b23] h-[48px] relative rounded-[10px] shrink-0 w-full border border-[#262a34]">
                        <div className="flex flex-row items-center size-full">
                          <div className="box-border content-stretch flex h-[48px] items-center justify-between pl-[12px] pr-[11px] py-[12px] relative w-full">
                            {/* Amount Input */}
                            <div className="content-stretch flex flex-col items-start justify-center relative flex-1">
                              <div className="content-stretch flex gap-[6px] items-center relative shrink-0">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={
                                    betAmountInput === ""
                                      ? ""
                                      : `$${betAmountInput}`
                                  }
                                  onChange={handleAmountChange}
                                  placeholder="$0"
                                  className="font-['Clash_Display',sans-serif] leading-[normal] text-[#8b5cf6] text-[20px] tracking-[-0.2px] bg-transparent border-none outline-none w-full placeholder:text-[#8b5cf6] placeholder:opacity-30 font-medium"
                                />
                              </div>
                            </div>

                            {/* Quick Add Buttons */}
                            <div className="content-stretch flex gap-[5px] items-center relative shrink-0">
                              <motion.button
                                onClick={() => handleQuickAdd(5)}
                                whileTap={{ scale: 0.9 }}
                                transition={{ duration: 0.15 }}
                                className="bg-[#8b5cf6]/10 content-stretch flex gap-[10px] h-[25px] items-center justify-center relative rounded-[16px] shrink-0 w-[36px] cursor-pointer hover:bg-[#8b5cf6]/20"
                              >
                                <p className="font-['Clash_Display',sans-serif] leading-[16px] relative shrink-0 text-[#7b7f8d] text-[14px] text-center text-nowrap whitespace-pre font-medium">
                                  +5
                                </p>
                              </motion.button>
                              <motion.button
                                onClick={() => handleQuickAdd(10)}
                                whileTap={{ scale: 0.9 }}
                                transition={{ duration: 0.15 }}
                                className="bg-[#8b5cf6]/10 content-stretch flex gap-[10px] h-[25px] items-center justify-center relative rounded-[16px] shrink-0 w-[36px] cursor-pointer hover:bg-[#8b5cf6]/20"
                              >
                                <p className="font-['Clash_Display',sans-serif] h-[16px] leading-[16px] relative shrink-0 text-[#7b7f8d] text-[14px] text-center text-nowrap whitespace-pre font-medium">
                                  +10
                                </p>
                              </motion.button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Error/Success Messages */}
                      {tradingError && (
                        <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-[10px] p-[12px] w-full">
                          <p className="font-['Clash_Display',sans-serif] text-[#ef4444] text-[14px] font-medium">
                            {tradingError}
                          </p>
                        </div>
                      )}
                      {tradingSuccess && (
                        <div className="bg-[#14b8a6]/10 border border-[#14b8a6]/30 rounded-[10px] p-[12px] w-full">
                          <p className="font-['Clash_Display',sans-serif] text-[#14b8a6] text-[14px] font-medium">
                            Order placed successfully!
                          </p>
                        </div>
                      )}

                      {/* Buy Button */}
                      <motion.button
                        onClick={handleBuy}
                        whileTap={{ scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        disabled={betAmount === 0 || isProcessing}
                        className={`h-[48px] relative rounded-[12px] shadow-[0px_1px_2px_0px_rgba(24,39,75,0.04)] shrink-0 w-full ${
                          betAmount > 0 && !isProcessing
                            ? "cursor-pointer"
                            : "cursor-not-allowed"
                        } ${
                          betAmount > 0 && !isProcessing
                            ? "bg-linear-to-r from-[#8b5cf6] to-[#06b6d4]"
                            : "bg-[#1a2239]"
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
                          <div
                            className={`box-border content-stretch flex flex-col h-[48px] items-center justify-center leading-[normal] px-[20px] py-[14px] relative text-[14px] text-nowrap w-full whitespace-pre ${
                              betAmount === 0 || isProcessing
                                ? "opacity-40"
                                : ""
                            }`}
                          >
                            <p className="font-['Clash_Display',sans-serif] relative shrink-0 text-[rgba(248,250,255,0.95)] font-bold">
                              {isProcessing
                                ? "Processing..."
                                : !solanaAccount
                                ? "Connect Wallet"
                                : `Buy ${
                                    selectedOption === "yes" ? "Yes" : "No"
                                  }`}
                            </p>
                            {betAmount > 0 && !isProcessing && (
                              <p className="font-['Clash_Display',sans-serif] relative shrink-0 text-[rgba(248,250,255,0.65)] font-medium">
                                To win ${potentialWin.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
      <div
        aria-hidden="true"
        className="absolute border-[#262a34] border-[0.571px] border-solid inset-0 pointer-events-none rounded-[22.837px]"
      />
    </motion.div>
  );

  return (
    <>
      {/* Blur Overlay */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.25,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={handleClose}
          />
        )}
      </AnimatePresence>

      {/* Placeholder to maintain grid space */}
      <div ref={cardRef} className="w-full">
        {isExpanded ? (
          <div className="bg-neutral-50 rounded-[22.837px] w-full opacity-0 pointer-events-none">
            <div className="content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] w-full">
              <div className="bg-white relative rounded-[22.837px] shrink-0 w-full">
                <div className="size-full">
                  <div className="box-border content-stretch flex flex-col gap-[13.702px] items-start p-[15.986px] relative w-full">
                    <div className="content-stretch flex gap-[9.135px] items-start relative shrink-0 w-full">
                      <div className="basis-0 content-stretch flex flex-col gap-[9.135px] grow items-start min-h-px min-w-px relative shrink-0">
                        <div className="bg-[#c4c4c4] overflow-clip relative rounded-[9.135px] shrink-0 size-[45.675px]" />
                        <p className="font-['Clash_Display',sans-serif] leading-[22.837px] min-w-full not-italic relative shrink-0 text-[#1a1a1a] text-[18.27px] tracking-[0.1827px]">
                          {question}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          cardContent
        )}
      </div>

      {/* Fixed positioned card when expanded */}
      {isExpanded && cardContent}
    </>
  );
}
