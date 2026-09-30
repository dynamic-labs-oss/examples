import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  handleDelegationCreated,
  handleDelegationRevoked,
  handlePing,
  verifyWebhookSignature,
  WebhookPayloadSchema,
} from "@/lib/dynamic/webhooks";

/**
 * Webhook endpoint for Dynamic events
 *
 * This endpoint receives webhooks from Dynamic and processes them securely:
 * 1. Verifies the webhook signature to ensure authenticity
 * 2. Validates the payload structure using Zod schemas
 * 3. Routes to appropriate handlers based on event type
 *
 * Configure this URL in your Dynamic dashboard:
 * https://your-domain.com/api/webhooks/dynamic
 *
 * Supported events:
 * - ping: Health check event
 * - wallet.delegation.created: Fired when a delegation is created
 * - wallet.delegation.revoked: Fired when a delegation is revoked
 */
export async function handleWebhookRequest(request: NextRequest) {
  // Step 1: Verify the signature and extract payload
  // This ensures the webhook is authentic and from Dynamic
  const verificationResult = await verifyWebhookSignature(request);

  if (!verificationResult.success) {
    return NextResponse.json(
      { error: verificationResult.error },
      { status: verificationResult.status }
    );
  }

  // Step 2: Validate payload structure with Zod
  // This ensures type safety and catches malformed payloads early
  const validationResult = WebhookPayloadSchema.safeParse(
    verificationResult.payload
  );

  if (!validationResult.success) {
    console.error("Invalid payload structure:", validationResult.error.issues);
    return NextResponse.json(
      {
        error: "Invalid payload structure",
        details: validationResult.error.issues,
      },
      { status: 400 }
    );
  }

  // Step 3: Route to appropriate handler based on event type
  // Add new event handlers here as you support more webhook events
  let result: { success: boolean; message: string };

  const payload = validationResult.data;
  switch (payload.eventName) {
    case "ping":
      result = await handlePing(payload);
      break;
    case "wallet.delegation.created":
      result = await handleDelegationCreated(payload);
      break;
    case "wallet.delegation.revoked":
      result = await handleDelegationRevoked(payload);
      break;

    default:
      // TypeScript ensures this switch is exhaustive
      // If you add a new event type to the schema, TypeScript will error here
      // until you add a corresponding case
      return NextResponse.json(
        { error: "Unexpected event type" },
        { status: 400 }
      );
  }

  return NextResponse.json(result, { status: 200 });
}
