import { NextResponse } from "next/server";

/**
 * Sample paid "cloud service" — stands in for an Azure service the agent buys.
 *
 * The x402 middleware (see /middleware.ts) gates this route: a request without a
 * valid payment gets HTTP 402 + payment requirements; once the caller attaches a
 * settled USDC payment, the request reaches this handler and we return the
 * "provisioned" resource. The handler itself contains no crypto — it just serves
 * the product the user paid for, framed in plain USD.
 */
export async function GET() {
  const provisionedAt = new Date().toISOString();
  return NextResponse.json({
    status: "provisioned",
    service: "Azure-style compute unit",
    resourceId: `vm-${Math.random().toString(36).slice(2, 10)}`,
    region: "eastus",
    spec: { vcpus: 2, memoryGb: 8 },
    priceUsd: "0.01",
    provisionedAt,
    message: "Compute unit provisioned. Charged $0.01 to your account.",
  });
}
