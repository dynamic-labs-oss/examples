import crypto from "crypto";
import type { NextRequest } from "next/server";
import { env } from "@/env";

/**
 * Verify webhook signature from Dynamic using HMAC SHA256
 *
 * This function handles the complete webhook verification process:
 * - Retrieves webhook secret from environment variables
 * - Extracts signature from request headers (supports both v1 and v2 headers)
 * - Parses request body as JSON
 * - Verifies signature using constant-time comparison to prevent timing attacks
 *
 * Security considerations:
 * - Uses `crypto.timingSafeEqual()` to prevent timing attacks when comparing signatures
 * - Never exposes the webhook secret in error messages
 * - Validates signature before processing payload to prevent processing malicious requests
 *
 * Production recommendations:
 * - Store DYNAMIC_WEBHOOK_SECRET in a secure secrets manager (AWS Secrets Manager, etc.)
 * - Never commit secrets to version control
 * - Use different secrets for different environments
 * - Monitor failed signature verifications for potential attacks
 *
 * @param request - Next.js request object containing headers and body
 * @returns Result object with success status, payload (if successful), or error details
 *
 * @see https://www.dynamic.xyz/docs/guides/webhooks-signature-validation
 */
export async function verifyWebhookSignature(
  request: NextRequest
): Promise<
  | { success: true; payload: unknown }
  | { success: false; error: string; status: number }
> {
  // Get the webhook secret from environment variables
  // In production, consider using a secrets manager instead
  const webhookSecret = env.DYNAMIC_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("DYNAMIC_WEBHOOK_SECRET is not configured");
    return {
      success: false,
      error: "Webhook secret not configured",
      status: 500,
    };
  }

  // Extract signature from headers
  const signature = request.headers.get("x-dynamic-signature-256");
  if (!signature) {
    console.error("No signature provided in webhook request");
    return {
      success: false,
      error: "No signature provided",
      status: 401,
    };
  }

  // Parse the request body as JSON
  // Note: We parse before verification, but only use it if signature is valid
  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch (error) {
    console.error("Failed to parse webhook payload:", error);
    return {
      success: false,
      error: "Invalid JSON payload",
      status: 400,
    };
  }

  // Compute HMAC SHA256 signature of the payload
  // The signature format is: sha256=<hex-encoded-hmac>
  const payloadSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(JSON.stringify(rawPayload))
    .digest("hex");
  const trusted = Buffer.from(`sha256=${payloadSignature}`, "ascii");
  const untrusted = Buffer.from(signature, "ascii");

  // crypto.timingSafeEqual throws if the buffers differ in length, so reject a
  // wrong-length signature first (an attacker could otherwise force a 500).
  // Use constant-time comparison to prevent timing attacks: the comparison takes
  // the same time regardless of where the first difference occurs.
  const isValid =
    trusted.length === untrusted.length &&
    crypto.timingSafeEqual(trusted, untrusted);

  if (!isValid) {
    console.error("Invalid webhook signature");
    return {
      success: false,
      error: "Invalid signature",
      status: 401,
    };
  }

  return { success: true, payload: rawPayload };
}
