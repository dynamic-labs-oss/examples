"use client";

import { loadCheckoutWebComponents } from "@checkout.com/checkout-web-components";
// No Dynamic SDK import needed — user email handled via checkout API directly
import { useCallback, useEffect, useRef, useState } from "react";
import { env } from "@/env";
import { useCheckout } from "@/lib/hooks/useCheckout";
import { AmountSelectionView } from "../coinbase-onramp/views/AmountSelectionView";
import { SuccessView } from "../coinbase-onramp/views/SuccessView";

interface PaymentResponse {
  id: string;
}

export interface CheckoutFlowProps {
  walletAddress: string;
  onViewChange?: (view: "amount" | "payment") => void;
  view?: "amount" | "payment";
}

type View = "amount" | "payment";

export function CheckoutFlow({
  walletAddress,
  onViewChange,
  view: externalView,
}: CheckoutFlowProps) {
  const [internalView, setInternalView] = useState<View>("amount");
  const view = externalView ?? internalView;
  const [amount, setAmount] = useState<string>("1");
  const [paymentSession, setPaymentSession] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [, setPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const flowContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checkoutInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flowComponentRef = useRef<any>(null);

  const { createPaymentSession } = useCheckout();

  useEffect(() => {
    if (view === "amount") {
      if (flowComponentRef.current) {
        try {
          flowComponentRef.current.unmount?.();
        } catch {
          // Ignore unmount errors
        }
        flowComponentRef.current = null;
      }
      if (checkoutInstanceRef.current) {
        try {
          checkoutInstanceRef.current.unmount?.();
        } catch {
          // Ignore unmount errors
        }
        checkoutInstanceRef.current = null;
      }
      setPaymentSession(null);
      setError(null);
      setShowSuccess(false);
    }
  }, [view]);

  useEffect(() => {
    if (view === "payment" && paymentSession && flowContainerRef.current) {
      const initializeFlow = async () => {
        try {
          if (flowComponentRef.current) {
            try {
              flowComponentRef.current.unmount?.();
            } catch {
              // Ignore unmount errors
            }
          }
          if (checkoutInstanceRef.current) {
            try {
              checkoutInstanceRef.current.unmount?.();
            } catch {
              // Ignore unmount errors
            }
          }

          const checkout = await loadCheckoutWebComponents({
            paymentSession: paymentSession as Record<string, unknown>,
            publicKey: env.NEXT_PUBLIC_CHECKOUT_PUBLIC_KEY,
            environment: env.NEXT_PUBLIC_CHECKOUT_ENVIRONMENT || "sandbox",
            appearance: {
              colorPrimary: "#72D0ED",
              colorSecondary: "#dde2f6",
              colorBackground: "#242735",
              colorFormBackground: "#2a2f42",
              colorFormBorder: "rgba(221, 226, 246, 0.1)",
              colorBorder: "rgba(221, 226, 246, 0.1)",
              colorError: "#ef4444",
              colorSuccess: "#10b981",
              colorAction: "#72D0ED",
              colorDisabled: "rgba(221, 226, 246, 0.3)",
              colorInverse: "#dde2f6",
              borderRadius: ["12px", "12px"],
              borderWidth: "1px",
              focusOutlineWidth: "2px",
            },
            onPaymentCompleted: async (
              _self: unknown,
              paymentResponse: PaymentResponse
            ) => {
              setPaymentId(paymentResponse.id);
              setShowSuccess(true);
              setError(null);
            },
          });

          checkoutInstanceRef.current = checkout;
          const flow = checkout.create("flow");
          flowComponentRef.current = flow;

          if (flowContainerRef.current) {
            flow.mount(flowContainerRef.current);

            setTimeout(() => {
              const style = document.createElement("style");
              style.id = "checkout-flow-button-styles";
              style.textContent = `
                #checkout-flow-container button,
                #checkout-flow-container button[type="button"],
                #checkout-flow-container button[type="submit"] {
                  color: #242735 !important;
                }
                #checkout-flow-container button *,
                #checkout-flow-container button[type="button"] *,
                #checkout-flow-container button[type="submit"] * {
                  color: #242735 !important;
                }
              `;
              const existingStyle = document.getElementById(
                "checkout-flow-button-styles"
              );
              if (existingStyle) {
                existingStyle.remove();
              }
              document.head.appendChild(style);
            }, 100);
          }
        } catch (err) {
          console.error("Failed to initialize Checkout Flow:", err);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load payment form. Please try again."
          );
        }
      };

      initializeFlow();
    }

    return () => {
      if (flowComponentRef.current) {
        try {
          flowComponentRef.current.unmount?.();
        } catch {
          // Ignore unmount errors
        }
      }
      if (checkoutInstanceRef.current) {
        try {
          checkoutInstanceRef.current.unmount?.();
        } catch {
          // Ignore unmount errors
        }
      }
    };
  }, [view, paymentSession, amount]);

  const handleAmountSelect = useCallback((selectedAmount: string) => {
    setAmount(selectedAmount);
  }, []);

  const handleContinue = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please select a valid amount");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const session = await createPaymentSession({
        amount: parseFloat(amount),
        currency: "USD",
        customerEmail: "",
        customerName: "Customer",
        walletAddress,
      });

      setPaymentSession(session);
      const newView: View = "payment";
      setInternalView(newView);
      onViewChange?.(newView);
    } catch (err) {
      console.error("Failed to create payment session:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create payment session"
      );
    } finally {
      setIsLoading(false);
    }
  }, [amount, createPaymentSession, walletAddress, onViewChange]);

  const handleStartNewTransaction = useCallback(() => {
    setShowSuccess(false);
    setPaymentId(null);
    setPaymentSession(null);
    setAmount("1");
    const newView: View = "amount";
    setInternalView(newView);
    onViewChange?.(newView);
  }, [onViewChange]);

  if (view === "amount") {
    return (
      <AmountSelectionView
        amount={amount}
        isLoading={isLoading}
        onAmountSelect={handleAmountSelect}
        onContinue={handleContinue}
      />
    );
  }

  if (view === "payment") {
    if (showSuccess) {
      return (
        <div className="flex flex-col">
          <SuccessView
            amount={amount}
            onStartNewTransaction={handleStartNewTransaction}
          />
        </div>
      );
    }

    return (
      <div className="p-[16px]">
        {error && (
          <div className="mb-[16px] p-[12px] bg-red-500/10 border border-red-500/20 rounded-[8px] text-red-400 text-sm">
            {error}
          </div>
        )}
        <div
          ref={flowContainerRef}
          id={`checkout-flow-container`}
          className="min-h-[400px]"
        />
      </div>
    );
  }

  return null;
}
