"use client";

import { useWallet } from "@/lib/providers";
import { ArrowLeft, X } from "lucide-react";
import { useId, useState } from "react";
import { CheckoutView } from "./deposit/CheckoutView";
import { DepositOptionsView } from "./deposit/DepositOptionsView";
import { QRCodeView } from "./deposit/QRCodeView";
import { LiFiView } from "./deposit/LiFiView";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type View = "options" | "qr" | "addFunds" | "lifi";

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { evmAccount } = useWallet();

  const modalTitleId = useId();
  const [view, setView] = useState<View>("options");
  const [checkoutView, setCheckoutView] = useState<"amount" | "payment">(
    "amount"
  );

  const walletAddress = evmAccount?.address || "";

  const handleReceiveByQR = () => setView("qr");
  const handleAddFunds = () => setView("addFunds");
  const handleLiFi = () => setView("lifi");

  const handleFundWallet = async () => {
    // Fund wallet functionality not available in JS SDK — show QR instead
    setView("qr");
  };

  const handleBack = () => {
    if (view === "addFunds" && checkoutView === "payment") {
      // If we're in the payment view, go back to amount selection
      setCheckoutView("amount");
    } else {
      // Otherwise, go back to options
      setView("options");
      setCheckoutView("amount");
    }
  };

  const handleClose = () => {
    setView("options");
    setCheckoutView("amount");
    onClose();
  };

  const getTitle = () => {
    if (view === "addFunds") {
      return checkoutView === "payment" ? "Complete Payment" : "Credit Card";
    }
    if (view === "lifi") return "Deposit from Any Chain";
    return "Deposit";
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Blur Overlay */}
      <button
        type="button"
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 border-0 p-0 cursor-pointer"
        onClick={handleClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") handleClose();
        }}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div
          className="bg-[#242735] rounded-[16px] w-full max-w-[400px] shadow-lg overflow-hidden pointer-events-auto my-auto max-h-[calc(100vh-2rem)] flex flex-col"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") handleClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-[20px] py-[16px] border-b border-[rgba(22,22,22,0.06)] shrink-0">
            {view !== "options" ? (
              <button
                type="button"
                onClick={handleBack}
                className="w-[24px] h-[24px] flex items-center justify-center text-[#dde2f6] hover:text-[#72D0ED] transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ArrowLeft className="w-[20px] h-[20px]" strokeWidth={2} />
              </button>
            ) : (
              <div className="w-[24px]" />
            )}
            <h2
              id={modalTitleId}
              className="flex-1 text-center font-['SF_Pro_Rounded:Semibold',sans-serif] text-[18px] text-[#dde2f6]"
            >
              {getTitle()}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="w-[24px] h-[24px] flex items-center justify-center text-[#dde2f6] hover:text-[#72D0ED] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-[20px] h-[20px]" strokeWidth={2} />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {view === "options" && (
              <DepositOptionsView
                onReceiveByQR={handleReceiveByQR}
                onFundWallet={handleFundWallet}
                onAddFunds={handleAddFunds}
                onLiFi={handleLiFi}
              />
            )}
            {view === "qr" && <QRCodeView walletAddress={walletAddress} />}
            {view === "addFunds" && (
              <CheckoutView
                walletAddress={walletAddress}
                onViewChange={setCheckoutView}
                view={checkoutView}
              />
            )}
            {view === "lifi" && (
              <LiFiView
                embeddedWalletAddress={walletAddress}
                onBack={handleBack}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
