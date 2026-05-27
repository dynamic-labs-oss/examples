"use client";

import { useState, useEffect } from "react";
import { Loader2, X, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/providers";
import {
  useCheckoutFunding,
  SOURCE_OPTIONS,
  type SourceOption,
} from "@/lib/useCheckoutFunding";

interface CheckoutFundingModalProps {
  amountUsd: number;
  tokenSymbol: string;
  onSettled: () => void;
  onClose: () => void;
}

export function CheckoutFundingModal({
  amountUsd,
  tokenSymbol,
  onSettled,
  onClose,
}: CheckoutFundingModalProps) {
  const { solanaAccount } = useWallet();
  const { step, quote, error, startFunding, confirm, reset } =
    useCheckoutFunding();
  const [selectedSource, setSelectedSource] = useState<SourceOption>(
    SOURCE_OPTIONS[0]
  );

  // Reset hook state whenever the modal mounts
  useEffect(() => {
    reset();
  }, [reset]);

  const handleGetQuote = async () => {
    if (!solanaAccount) return;
    await startFunding(amountUsd, solanaAccount.address, selectedSource);
  };

  const handleConfirm = async () => {
    if (!solanaAccount) return;
    await confirm(solanaAccount, onSettled);
  };

  const isLoading =
    step === "loading" || step === "signing" || step === "settling";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-[#DADADA] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#DADADA]">
          <div>
            <h2 className="text-sm font-semibold text-[#030303]">
              Fund your subscription wallet
            </h2>
            <p className="text-xs text-[#606060] mt-0.5">
              You need {amountUsd.toFixed(2)} {tokenSymbol} to subscribe
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded-lg text-[#606060] hover:text-[#030303] hover:bg-[#F9F9F9] transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Source selection (shown before getting quote) */}
          {(step === "idle" || step === "error") && (
            <>
              <div>
                <p className="text-xs font-medium text-[#606060] mb-2">
                  Pay with
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SOURCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedSource(opt)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-medium transition-colors",
                        selectedSource.id === opt.id
                          ? "border-[#4779FF] bg-[#E8F0FE]/30 text-[#4779FF]"
                          : "border-[#DADADA] text-[#606060] hover:border-[#4779FF]/50"
                      )}
                    >
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-[10px] font-normal">{opt.subLabel}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Powered by Dynamic Checkout */}
              <div className="flex items-center gap-2 rounded-lg bg-[#F9F9F9] px-3 py-2 text-xs text-[#606060]">
                <ArrowRight className="w-3.5 h-3.5 text-[#4779FF] shrink-0" />
                Dynamic Checkout routes {selectedSource.label} →{" "}
                {Number(amountUsd).toFixed(2)} USDC in one step
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleGetQuote}
                disabled={!solanaAccount}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] disabled:opacity-50 transition-colors"
              >
                Get quote
              </button>
            </>
          )}

          {/* Loading — fetching quote */}
          {step === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-8 h-8 animate-spin text-[#4779FF]" />
              <p className="text-sm text-[#606060]">Finding best route…</p>
            </div>
          )}

          {/* Quote ready */}
          {step === "quoted" && quote && (
            <>
              <div className="rounded-xl border border-[#DADADA] bg-[#F9F9F9] p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#606060]">You pay</span>
                  <span className="font-semibold text-[#030303]">
                    {quote.fromAmount} {quote.fromSymbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#606060]">You receive</span>
                  <span className="font-semibold text-[#030303]">
                    {quote.toAmount} {quote.toSymbol}
                  </span>
                </div>
                <div className="border-t border-[#DADADA] pt-2 flex items-center justify-between text-xs text-[#606060]">
                  <span>Bridge fees</span>
                  <span>${quote.feeUsd}</span>
                </div>
              </div>

              <p className="text-xs text-[#606060] text-center">
                Powered by Dynamic Checkout — swap & bridge in one step
              </p>

              <button
                onClick={handleConfirm}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] transition-colors"
              >
                Confirm &amp; pay
              </button>
              <button
                onClick={reset}
                className="w-full py-2 rounded-xl text-sm text-[#606060] hover:text-[#030303] transition-colors"
              >
                Change source
              </button>
            </>
          )}

          {/* Signing */}
          {step === "signing" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-8 h-8 animate-spin text-[#4779FF]" />
              <p className="text-sm text-[#606060]">
                Check your wallet to sign…
              </p>
            </div>
          )}

          {/* Settling */}
          {step === "settling" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-8 h-8 animate-spin text-[#4779FF]" />
              <p className="text-sm font-medium text-[#030303]">
                Bridging funds…
              </p>
              <p className="text-xs text-[#606060] text-center">
                Your USDC is on the way. This usually takes 15–60 seconds.
              </p>
            </div>
          )}

          {/* Completed */}
          {step === "completed" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
              <p className="text-sm font-medium text-[#030303]">
                Wallet funded!
              </p>
              <p className="text-xs text-[#606060]">Subscribing now…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
