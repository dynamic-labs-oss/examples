"use client";

import { useWallet } from "@/lib/providers";
import { ArrowLeft, X } from "lucide-react";
import { useId, useState } from "react";
import { DepositOptionsView } from "./deposit/DepositOptionsView";
import { QRCodeView } from "./deposit/QRCodeView";
import { LiFiView } from "./deposit/LiFiView";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type View = "options" | "qr" | "lifi";

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { solanaAccount } = useWallet();

  const modalTitleId = useId();
  const [view, setView] = useState<View>("options");

  const walletAddress = solanaAccount?.address || "";

  const handleReceiveByQR = () => setView("qr");
  const handleLiFi = () => setView("lifi");

  const handleFundWallet = async () => {
    // Fund wallet functionality not available in JS SDK — show QR instead
    setView("qr");
  };

  const handleBack = () => {
    setView("options");
  };

  const handleClose = () => {
    setView("options");
    onClose();
  };

  const getTitle = () => {
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
          className="bg-[#0e1015] rounded-[16px] w-full max-w-[400px] shadow-lg overflow-hidden pointer-events-auto my-auto max-h-[calc(100vh-2rem)] flex flex-col border border-[#262a34]"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") handleClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-[20px] py-[16px] border-b border-[#262a34] shrink-0">
            {view !== "options" ? (
              <button
                type="button"
                onClick={handleBack}
                className="w-[24px] h-[24px] flex items-center justify-center text-white hover:text-[#8b5cf6] transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ArrowLeft className="w-[20px] h-[20px]" strokeWidth={2} />
              </button>
            ) : (
              <div className="w-[24px]" />
            )}
            <h2
              id={modalTitleId}
              className="flex-1 text-center font-['Clash_Display',sans-serif] text-[18px] text-white font-semibold"
            >
              {getTitle()}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="w-[24px] h-[24px] flex items-center justify-center text-white hover:text-[#8b5cf6] transition-colors cursor-pointer"
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
                onLiFi={handleLiFi}
              />
            )}
            {view === "qr" && <QRCodeView walletAddress={walletAddress} />}
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
