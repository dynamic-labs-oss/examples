/**
 * Unified Offramp API Route
 *
 * POST /api/offramp - Handle offramp operations (quote or execute)
 *
 * Actions:
 * - quote: Get a quote for crypto to fiat conversion
 * - execute: Execute an offramp with a quote
 *
 * Reference: https://docs.iron.xyz
 */

import { NextRequest } from "next/server";
import { createResponse, handleApiError } from "@/lib/api-response";
import {
  ironClient,
  type OfframpQuoteRequest,
  type CreateOfframpRequest,
} from "@/lib/services/iron";
import { z } from "zod";

const quoteSchema = z.object({
  action: z.literal("quote"),
  customer_id: z.string().min(1, "Customer ID is required"),
  source_currency: z.enum(["USDC", "USDT", "USDB", "EURC"]),
  destination_currency: z.enum(["USD", "EUR", "GBP", "BRL", "MXN"]),
  source_amount: z.number().positive().optional(),
  destination_amount: z.number().positive().optional(),
  bank_account_id: z.string().min(1, "Bank account ID (IBAN) is required"),
  bank_id: z.string().optional(),
  blockchain: z.enum(["Ethereum", "Solana", "Polygon", "Arbitrum", "Base", "Stellar", "Citrea"]).optional(),
});

const executeSchema = z.object({
  action: z.literal("execute"),
  quote_id: z.string().min(1, "Quote ID is required"),
  customer_id: z.string().min(1, "Customer ID is required"),
  bank_account_id: z.string().min(1, "Bank account ID (IBAN) is required"),
  bank_id: z.string().optional(),
  blockchain: z.enum(["Ethereum", "Solana", "Polygon", "Arbitrum", "Base", "Stellar", "Citrea"]).optional(),
  source_currency: z.enum(["USDC", "USDT", "USDB", "EURC"]).optional(),
  destination_currency: z.enum(["USD", "EUR", "GBP", "BRL", "MXN"]).optional(),
});

const requestSchema = z.discriminatedUnion("action", [
  quoteSchema,
  executeSchema,
]);

/**
 * POST /api/offramp
 * Unified offramp endpoint - handles both quote and execute
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request body
    const validated = requestSchema.parse(body);

    if (validated.action === "quote") {
      // Get offramp quote
      const quoteRequest: OfframpQuoteRequest = {
        customer_id: validated.customer_id,
        source_currency: validated.source_currency,
        destination_currency: validated.destination_currency,
        source_amount: validated.source_amount,
        destination_amount: validated.destination_amount,
        bank_account_id: validated.bank_account_id,
        bank_id: validated.bank_id,
        blockchain: validated.blockchain,
      };

      const quote = await ironClient.getOfframpQuote(quoteRequest);
      return createResponse(quote, 200);
    } else {
      // Execute offramp
      const offrampRequest: CreateOfframpRequest = {
        quote_id: validated.quote_id,
        customer_id: validated.customer_id,
        bank_account_id: validated.bank_account_id,
        bank_id: validated.bank_id,
        blockchain: validated.blockchain,
        source_currency: validated.source_currency,
        destination_currency: validated.destination_currency,
      };

      const offramp = await ironClient.createOfframp(offrampRequest);
      return createResponse(offramp, 201);
    }
  } catch (error) {
    return handleApiError(error, "offramp");
  }
}
