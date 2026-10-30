import "server-only";
import crypto from "crypto";
import type { NextRequest } from "next/server";
import { env } from "@/env";

/** HMAC-SHA256 verification for Dynamic webhook deliveries. */
export async function verifyWebhookSignature(
  request: NextRequest
): Promise<
  | { success: true; payload: unknown }
  | { success: false; error: string; status: number }
> {
  const webhookSecret = env.DYNAMIC_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return {
      success: false,
      error: "Webhook secret not configured",
      status: 500,
    };
  }

  const signature = request.headers.get("x-dynamic-signature-256");
  if (!signature) {
    return { success: false, error: "No signature provided", status: 401 };
  }

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return { success: false, error: "Invalid JSON payload", status: 400 };
  }

  const payloadSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(JSON.stringify(rawPayload))
    .digest("hex");
  const trusted = Buffer.from(`sha256=${payloadSignature}`, "ascii");
  const untrusted = Buffer.from(signature, "ascii");
  if (trusted.length !== untrusted.length || !crypto.timingSafeEqual(trusted, untrusted)) {
    return { success: false, error: "Invalid signature", status: 401 };
  }

  return { success: true, payload: rawPayload };
}
