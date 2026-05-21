"use client";

import { useId } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
  isLoading = false,
}: ConfirmModalProps) {
  const modalTitleId = useId();

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      iconBg: "bg-[rgba(230,67,65,0.1)]",
      iconColor: "text-[#e64341]",
      buttonBg: "bg-[#e64341] hover:bg-[#c73533]",
    },
    warning: {
      iconBg: "bg-[rgba(245,158,11,0.1)]",
      iconColor: "text-[#f59e0b]",
      buttonBg: "bg-[#f59e0b] hover:bg-[#d97706]",
    },
    info: {
      iconBg: "bg-[rgba(71,121,255,0.1)]",
      iconColor: "text-[#4779FF]",
      buttonBg: "bg-[#4779FF] hover:bg-[#3560d4]",
    },
  };

  const styles = variantStyles[variant];

  return (
    <>
      {/* Blur Overlay */}
      <button
        type="button"
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] border-0 p-0 cursor-pointer"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        aria-label="Close modal"
        disabled={isLoading}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white border border-[#DADADA] rounded-[16px] w-full max-w-[360px] shadow-lg overflow-hidden pointer-events-auto animate-in zoom-in-95 fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-[#606060] hover:text-[#030303] transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="p-6 text-center">
            {/* Icon */}
            <div
              className={`w-14 h-14 rounded-full ${styles.iconBg} flex items-center justify-center mx-auto mb-4`}
            >
              <AlertTriangle className={`w-7 h-7 ${styles.iconColor}`} />
            </div>

            {/* Title */}
            <h3
              id={modalTitleId}
              className="text-[18px] text-[#030303] mb-2"
            >
              {title}
            </h3>

            {/* Message */}
            <p className="text-[14px] text-[#606060] mb-6">
              {message}
            </p>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 py-3 px-4 rounded-[10px] bg-[#F0F0F0] text-[#030303] text-[14px] hover:bg-[#EBEBEB] transition-colors cursor-pointer disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 py-3 px-4 rounded-[10px] ${styles.buttonBg} text-white text-[14px] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
