import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleWebhookRequest } from "./handler";

/**
 * POST handler for Dynamic webhooks
 *
 * Wraps the webhook handler in error handling to ensure
 * all errors are caught and returned as proper HTTP responses
 */
export async function POST(request: NextRequest) {
  try {
    return await handleWebhookRequest(request);
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
