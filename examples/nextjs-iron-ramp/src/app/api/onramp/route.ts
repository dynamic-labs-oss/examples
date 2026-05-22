/**
 * Unified Onramp API Route
 *
 * POST /api/onramp - Handle onramp operations (quote or execute)
 *
 * Actions:
 * - quote: Get a quote for fiat to crypto conversion
 * - execute: Execute an onramp with a quote
 *
 * Reference: https://docs.iron.xyz
 */

import { NextRequest } from "next/server";
import { createResponse, handleApiError } from "@/lib/api-response";
import {
  ironClient,
  type OnrampQuoteRequest,
  type CreateOnrampRequest,
} from "@/lib/services/iron";
import { z } from "zod";

const quoteSchema = z.object({
  action: z.literal("quote"),
  customer_id: z.string().min(1, "Customer ID is required"),
  source_currency: z.enum(["USD", "EUR", "GBP", "BRL", "MXN"]),
  destination_currency: z.enum(["USDC", "USDT", "USDB", "EURC"]),
  source_amount: z.number().positive().optional(),
  destination_amount: z.number().positive().optional(),
  payment_rail: z.enum(["ach", "wire", "sepa", "pix", "faster_payments"]),
  wallet_address: z.string().min(1, "Wallet address is required"),
  wallet_id: z.string().optional(),
  blockchain: z.enum(["Ethereum", "Solana", "Polygon", "Arbitrum", "Base", "Stellar", "Citrea"]).optional(),
});

const executeSchema = z.object({
  action: z.literal("execute"),
  quote_id: z.string().min(1, "Quote ID is required"),
  customer_id: z.string().min(1, "Customer ID is required"),
  wallet_address: z.string().min(1, "Wallet address is required"),
  wallet_id: z.string().optional(),
  bank_account_id: z.string().optional(),
  blockchain: z.enum(["Ethereum", "Solana", "Polygon", "Arbitrum", "Base", "Stellar", "Citrea"]).optional(),
  source_currency: z.enum(["USD", "EUR", "GBP", "BRL", "MXN"]).optional(),
  destination_currency: z.enum(["USDC", "USDT", "USDB", "EURC"]).optional(),
});

const requestSchema = z.discriminatedUnion("action", [
  quoteSchema,
  executeSchema,
]);

/**
 * POST /api/onramp
 * Unified onramp endpoint - handles both quote and execute
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request body
    const validated = requestSchema.parse(body);

    if (validated.action === "quote") {
      // Get onramp quote
      const quoteRequest: OnrampQuoteRequest = {
        customer_id: validated.customer_id,
        source_currency: validated.source_currency,
        destination_currency: validated.destination_currency,
        source_amount: validated.source_amount,
        destination_amount: validated.destination_amount,
        payment_rail: validated.payment_rail,
        wallet_address: validated.wallet_address,
        wallet_id: validated.wallet_id,
        blockchain: validated.blockchain,
      };

      const quote = await ironClient.getOnrampQuote(quoteRequest);
      return createResponse(quote, 200);
    } else {
      // Execute onramp
      const onrampRequest: CreateOnrampRequest = {
        quote_id: validated.quote_id,
        customer_id: validated.customer_id,
        wallet_address: validated.wallet_address,
        wallet_id: validated.wallet_id,
        bank_account_id: validated.bank_account_id,
        blockchain: validated.blockchain,
        source_currency: validated.source_currency,
        destination_currency: validated.destination_currency,
      };

      const onramp = await ironClient.createOnramp(onrampRequest);
      return createResponse(onramp, 201);
    }
  } catch (error) {
    return handleApiError(error, "onramp");
  }
}
