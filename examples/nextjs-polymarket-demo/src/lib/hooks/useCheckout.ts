"use client";

import type {
  CreatePaymentSessionParams,
  PaymentSessionResponse,
} from "@/lib/types/checkout";

export function useCheckout() {
  const createPaymentSession = async (
    params: CreatePaymentSessionParams
  ): Promise<PaymentSessionResponse> => {
    try {
      const response = await fetch("/api/checkout/payment-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          `Failed to create payment session: ${response.status} ${
            response.statusText
          }. ${errorData.error || ""}`
        );
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("[useCheckout]: Failed to create payment session:", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to create payment session");
    }
  };

  return {
    createPaymentSession,
  };
}
