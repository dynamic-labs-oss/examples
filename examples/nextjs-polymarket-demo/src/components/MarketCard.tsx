import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import ClockIcon from "./ClockIcon";
import { ImageWithFallback } from "./ImageWithFallback";
import PriceChart from "./PriceChart";
import { usePolymarketTrading } from "@/lib/hooks/usePolymarketTrading";
import { polygon } from "viem/chains";
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
  conditionId?: string;
  yesTokenId?: string;
  noTokenId?: string;
  marketId?: string;
  tags?: string[];
}

const TAG_COLORS: Record<string, string> = {
  trending: "bg-[#ff6b6b]/20 text-[#ff6b6b] border-[#ff6b6b]/30",
  hot: "bg-[#ff9500]/20 text-[#ff9500] border-[#ff9500]/30",
  new: "bg-[#4ecdc4]/20 text-[#4ecdc4] border-[#4ecdc4]/30",
  "ending soon": "bg-[#ffd93d]/20 text-[#ffd93d] border-[#ffd93d]/30",
  "high stakes": "bg-[#9b59b6]/20 text-[#9b59b6] border-[#9b59b6]/30",
  "close call": "bg-[#3498db]/20 text-[#3498db] border-[#3498db]/30",
};

export function MarketCard({
  question,
  timeRemaining,
  yesPrice,
  noPrice,
  imageUrl,
  yesTraders,
  noTraders,
  conditionId,
  yesTokenId,
  noTokenId,
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
  // Local loading state to properly track buy operation (prevents flash between hook's isLoading and success state)
  const [isProcessing, setIsProcessing] = useState(false);
  const cardPosition = useRef<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Ref to prevent double-submission of orders
  const isSubmittingRef = useRef(false);

  const { evmAccount } = useWallet();
  const { placeOrder } = usePolymarketTrading();

  const handleOptionClick = (option: "yes" | "no") => {
    // If wallet not connected, show connect modal
    if (!evmAccount) {
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
    }, 300); // Reset after animation (increased from 200ms)
  }, []);

  const handleQuickAdd = (amount: number) => {
    const newAmount = betAmount + amount;
    setBetAmount(newAmount);
    setBetAmountInput(newAmount === 0 ? "" : newAmount.toString());
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // Remove $ sign if present
    value = value.replace(/\$/g, "");

    // Allow digits, single decimal point, and empty string
    // Prevent multiple decimal points
    const parts = value.split(".");
    if (parts.length > 2) {
      value = parts[0] + "." + parts.slice(1).join("");
    }

    // Only allow digits and a single decimal point
    value = value.replace(/[^0-9.]/g, "");

    // Update input string
    setBetAmountInput(value);

    // If empty or just a decimal point, set amount to 0
    if (value === "" || value === ".") {
      setBetAmount(0);
      return;
    }

    // Parse as float to allow decimals
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setBetAmount(numValue);
    }
  };

  const handleBuy = useCallback(async () => {
    // Prevent double-submission - check ref only (not isProcessing to avoid stale closures)
    if (isSubmittingRef.current) return;
    if (betAmount === 0 || !selectedOption) return;

    // Check if wallet is connected first
    if (!evmAccount) {
      return;
    }

    if (!conditionId || (!yesTokenId && !noTokenId)) {
      setTradingError("Market data incomplete. Please try again.");
      return;
    }

    // Set submitting flag and local loading state immediately to prevent double-clicks
    isSubmittingRef.current = true;
    setIsProcessing(true);
    setTradingError(null);
    setTradingSuccess(false);

    try {
      // Network switching is handled by the wallet client configured with polygon chain

      // Get the appropriate token ID
      const tokenId = selectedOption === "yes" ? yesTokenId : noTokenId;
      if (!tokenId) {
        setTradingError("Token ID not available for this market");
        return;
      }

      // Place the order as a market order so it fills immediately
      const result = await placeOrder({
        marketId: marketId || "",
        conditionId,
        tokenId,
        side: selectedOption,
        amount: betAmount,
        isMarketOrder: true, // Execute at market price for immediate fill
      });

      if (result.success) {
        // Set success state BEFORE clearing processing to prevent flash
        setTradingSuccess(true);
        setIsProcessing(false);
        // Close after a short delay to show success
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
      console.error("Trading error:", error);
    } finally {
      // Always reset the submitting flag when done
      isSubmittingRef.current = false;
    }
  }, [
    betAmount,
    selectedOption,
    evmAccount,
    conditionId,
    yesTokenId,
    noTokenId,
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
      className={`bg-white border border-[#DADADA] rounded-[22.837px] w-full relative shadow-sm ${
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
        <div className="bg-white relative rounded-[22.837px] shrink-0 w-full">
          <div className="size-full">
            <div className="box-border content-stretch flex flex-col gap-[13.702px] items-start p-[15.986px] relative w-full">
              <div className="content-stretch flex gap-[9.135px] items-start relative shrink-0 w-full">
                {/* Image and Question */}
                <div className="basis-0 content-stretch flex flex-col gap-[9.135px] grow items-start min-h-px min-w-px relative shrink-0">
                  <div className="bg-[#EBEBEB] overflow-clip relative rounded-[7px] shrink-0 size-[45.675px]">
                    {imageUrl ? (
                      <ImageWithFallback
                        src={imageUrl}
                        alt="Market thumbnail"
                        className="absolute left-0 top-0 size-[45.675px] object-cover"
                        sizes="50px"
                      />
                    ) : (
                      <div className="absolute bg-[#EBEBEB] left-0 size-[45.675px] top-0" />
                    )}
                  </div>
                  <p
                    className={`font-semibold leading-[22.837px] relative shrink-0 text-[#030303] text-[18.27px] tracking-[0.1827px] ${
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
                          "bg-[#F0F0F0] text-[#606060] border-[#DADADA]";
                        return (
                          <span
                            key={tag}
                            className={`px-[6px] py-[2px] rounded-[12px] text-[11px] font-medium border ${tagColor}`}
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
                    <p className="font-medium leading-[18.27px] relative shrink-0 text-[13.702px] text-[#606060] text-nowrap tracking-[0.137px] whitespace-pre">
                      {timeRemaining}
                    </p>
                  </div>
                </div>
              </div>

              {/* Trader Bar - Only show if trader data is available */}
              {yesTraders !== undefined && noTraders !== undefined && (
                <div className="bg-[#F9F9F9] border border-[#DADADA] h-[80px] relative rounded-[12px] shrink-0 w-full">
                  <div className="h-[80px] overflow-clip relative rounded-[inherit] w-full">
                    {/* Left Panel */}
                    <div className="absolute bg-[#F9F9F9] bottom-0 box-border content-stretch flex flex-col items-start justify-between left-0 p-[8px] top-0 w-[100px]">
                      <div
                        aria-hidden="true"
                        className="absolute border-[#DADADA] border-[0px_0.5px_0px_0px] border-solid inset-0 pointer-events-none"
                      />
                      <div className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-full">
                        {/* Yes Percentage */}
                        <div className="bg-[rgba(255,255,255,0.05)] box-border content-stretch flex flex-col gap-[4px] h-[18px] items-center justify-center px-[8px] py-[6px] relative rounded-[20px] shrink-0 min-w-[51px]">
                          <div
                            aria-hidden="true"
                            className="absolute border-[0.5px] border-[rgba(224,224,224,0.05)] border-solid inset-0 pointer-events-none rounded-[20px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.02),0px_1px_2px_0px_rgba(0,0,0,0.02)]"
                          />
                          <div className="flex flex-col font-['SF_Pro_Rounded:Semibold',sans-serif] justify-center leading-0 not-italic relative shrink-0 text-[#3ea34b] text-[9px] text-nowrap">
                            <p className="leading-[13px] whitespace-nowrap">
                              Yes {yesPrice}%
                            </p>
                          </div>
                        </div>
                        {/* No Percentage */}
                        <div className="bg-[rgba(255,255,255,0.05)] box-border content-stretch flex flex-col gap-[4px] h-[18px] items-center justify-center px-[8px] py-[6px] relative rounded-[20px] shrink-0 min-w-[42px]">
                          <div
                            aria-hidden="true"
                            className="absolute border-[0.5px] border-[rgba(224,224,224,0.05)] border-solid inset-0 pointer-events-none rounded-[20px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.02),0px_1px_2px_0px_rgba(0,0,0,0.02)]"
                          />
                          <div className="flex flex-col font-['SF_Pro_Rounded:Semibold',sans-serif] justify-center leading-0 not-italic relative shrink-0 text-[#e64341] text-[9px] text-nowrap">
                            <p className="leading-[13px] whitespace-nowrap">
                              No {noPrice}%
                            </p>
                          </div>
                        </div>
                      </div>
                      {/* Volume Display */}
                      <div className="flex flex-col font-medium justify-center leading-0 relative shrink-0 text-[#606060] text-[10px] text-nowrap">
                        <p className="leading-[13px] whitespace-pre">
                          ${((yesTraders + noTraders) * 234).toLocaleString()}{" "}
                          Vol.
                        </p>
                      </div>
                    </div>

                    {/* Chart Area */}
                    <PriceChart />
                  </div>
                  <div
                    aria-hidden="true"
                    className="absolute border-[#262a34] border-[0.5px] border-solid inset-0 pointer-events-none rounded-[12px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.02),0px_1px_2px_0px_rgba(0,0,0,0.02)]"
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
                      ? "bg-[#3ea34b]"
                      : "bg-[rgba(62,163,75,0.1)] hover:opacity-80"
                  }`}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="flex flex-row items-center justify-center size-full">
                    <div className="box-border content-stretch flex gap-[22.837px] items-center justify-center px-[22.837px] py-[11.419px] relative size-full">
                      <div
                        className={`flex flex-col font-semibold justify-center relative shrink-0 text-[15.986px] text-nowrap text-right ${
                          selectedOption === "yes" ? "text-white" : "text-[#3ea34b]"
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
                      ? "bg-[#e64341]"
                      : "bg-[rgba(230,67,65,0.1)] hover:opacity-80"
                  }`}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="flex flex-row items-center justify-center size-full">
                    <div className="box-border content-stretch flex gap-[22.837px] items-center justify-center px-[22.837px] py-[11.419px] relative size-full">
                      <div
                        className={`flex flex-col font-semibold justify-center relative shrink-0 text-[15.986px] text-nowrap text-right ${
                          selectedOption === "no" ? "text-white" : "text-[#e64341]"
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
                      ease: [0.25, 0.46, 0.45, 0.94], // easeOutQuad
                    }}
                    className="overflow-hidden w-full"
                  >
                    <div className="content-stretch flex flex-col gap-[11px] items-start w-full">
                      {/* Input Field */}
                      <div className="bg-[#F9F9F9] border border-[#DADADA] h-[48px] relative rounded-[10px] shrink-0 w-full">
                        <div className="flex flex-row items-center size-full">
                          <div className="box-border content-stretch flex h-[48px] items-center justify-between pl-[12px] pr-[11px] py-[12px] relative w-full">
                            {/* Amount Input */}
                            <div className="content-stretch flex flex-col items-start justify-center relative flex-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={betAmountInput === "" ? "" : `$${betAmountInput}`}
                                onChange={handleAmountChange}
                                placeholder="$0"
                                className="font-medium leading-[normal] text-[#4779FF] text-[20px] tracking-[-0.2px] bg-transparent border-none outline-none w-full placeholder:text-[#4779FF] placeholder:opacity-30"
                              />
                            </div>

                            {/* Quick Add Buttons */}
                            <div className="content-stretch flex gap-[5px] items-center relative shrink-0">
                              <motion.button
                                onClick={() => handleQuickAdd(5)}
                                whileTap={{ scale: 0.9 }}
                                transition={{ duration: 0.15 }}
                                className="bg-[#EBEBEB] content-stretch flex gap-[10px] h-[25px] items-center justify-center relative rounded-[16px] shrink-0 w-[36px] cursor-pointer hover:bg-[#DADADA]"
                              >
                                <p className="font-medium leading-[16px] relative shrink-0 text-[#606060] text-[14px] text-center text-nowrap whitespace-pre">
                                  +5
                                </p>
                              </motion.button>
                              <motion.button
                                onClick={() => handleQuickAdd(10)}
                                whileTap={{ scale: 0.9 }}
                                transition={{ duration: 0.15 }}
                                className="bg-[#EBEBEB] content-stretch flex gap-[10px] h-[25px] items-center justify-center relative rounded-[16px] shrink-0 w-[36px] cursor-pointer hover:bg-[#DADADA]"
                              >
                                <p className="font-medium h-[16px] leading-[16px] relative shrink-0 text-[#606060] text-[14px] text-center text-nowrap whitespace-pre">
                                  +10
                                </p>
                              </motion.button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Error/Success Messages */}
                      {tradingError && (
                        <div className="bg-[rgba(230,67,65,0.1)] border border-[rgba(230,67,65,0.3)] rounded-[10px] p-[12px]">
                          <p className="font-medium text-[#e64341] text-[14px]">
                            {tradingError}
                          </p>
                        </div>
                      )}
                      {tradingSuccess && (
                        <div className="bg-[rgba(62,163,75,0.1)] border border-[rgba(62,163,75,0.3)] rounded-[10px] p-[12px]">
                          <p className="font-medium text-[#3ea34b] text-[14px]">
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
                        className={`h-[48px] relative rounded-[12px] shrink-0 w-full transition-all duration-150 ${
                          betAmount > 0 && !isProcessing
                            ? "cursor-pointer bg-[#4779FF]"
                            : "cursor-not-allowed bg-[#F0F0F0]"
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
                          <div className="box-border content-stretch flex flex-col h-[48px] items-center justify-center leading-[normal] px-[20px] py-[14px] relative text-[14px] text-nowrap w-full whitespace-pre">
                            <p className={`font-semibold relative shrink-0 ${betAmount > 0 && !isProcessing ? "text-white" : "text-[#606060]"}`}>
                              {isProcessing
                                ? "Processing..."
                                : !evmAccount
                                ? "Connect Wallet"
                                : `Buy ${selectedOption === "yes" ? "Yes" : "No"}`}
                            </p>
                            {betAmount > 0 && !isProcessing && (
                              <p className="font-medium relative shrink-0 text-white/70">
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
              ease: [0.25, 0.46, 0.45, 0.94], // easeOutQuad
            }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={handleClose}
          />
        )}
      </AnimatePresence>

      {/* Placeholder to maintain grid space */}
      <div ref={cardRef} className="w-full">
        {isExpanded ? (
          // Invisible placeholder to keep grid space
          <div className="bg-white border border-[#DADADA] rounded-[22.837px] w-full opacity-0 pointer-events-none">
            <div className="content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] w-full">
              <div className="bg-white relative rounded-[22.837px] shrink-0 w-full">
                <div className="size-full">
                  <div className="box-border content-stretch flex flex-col gap-[13.702px] items-start p-[15.986px] relative w-full">
                    <div className="content-stretch flex gap-[9.135px] items-start relative shrink-0 w-full">
                      <div className="basis-0 content-stretch flex flex-col gap-[9.135px] grow items-start min-h-px min-w-px relative shrink-0">
                        <div className="bg-[#c4c4c4] overflow-clip relative rounded-[9.135px] shrink-0 size-[45.675px]" />
                        <p className="font-['SF_Pro_Rounded:Bold',sans-serif] leading-[22.837px] min-w-full not-italic relative shrink-0 text-[#1a1a1a] text-[18.27px] tracking-[0.1827px] w-min-content">
                          {question}
                        </p>
                      </div>
                      <div className="content-stretch flex gap-[9.135px] h-[27.405px] items-center justify-end relative shrink-0">
                        <div className="content-stretch flex gap-[4.567px] items-center overflow-clip relative shrink-0">
                          <ClockIcon />
                          <p className="font-['SF_Pro_Rounded:Semibold',sans-serif] leading-[18.27px] not-italic relative shrink-0 text-[13.702px] text-[rgba(26,26,26,0.5)] text-nowrap tracking-[0.137px] whitespace-pre">
                            {timeRemaining}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative shrink-0 w-full">
                <div className="flex flex-col justify-center size-full">
                  <div className="box-border content-stretch flex flex-col gap-[11px] items-start p-[13.702px] relative w-full">
                    <div className="content-stretch flex gap-[4.567px] h-[41.107px] items-start relative shrink-0 w-full" />
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
