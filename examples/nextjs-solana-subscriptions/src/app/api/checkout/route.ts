import { NextResponse } from "next/server";

const DYNAMIC_BASE = "https://app.dynamicauth.com/api/v0";

// POST /api/checkout
// Body: { walletAddress: string }
// Creates a Dynamic Checkout config that settles USDC to the user's Solana wallet.
// Returns: { checkoutId: string }
export async function POST(req: Request) {
  const apiToken = process.env.DYNAMIC_API_TOKEN;
  const envId = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;

  if (!apiToken) {
    return NextResponse.json(
      { error: "DYNAMIC_API_TOKEN is not configured" },
      { status: 500 }
    );
  }
  if (!envId) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_DYNAMIC_ENV_ID is not configured" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const walletAddress = body?.walletAddress;
  if (!walletAddress || typeof walletAddress !== "string") {
    return NextResponse.json(
      { error: "walletAddress is required" },
      { status: 400 }
    );
  }

  // Settlement: USDC on Solana mainnet (networkId 101).
  const settlementTokenAddress =
    process.env.NEXT_PUBLIC_CHECKOUT_SETTLEMENT_TOKEN ??
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // mainnet USDC

  const res = await fetch(
    `${DYNAMIC_BASE}/environments/${envId}/checkouts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        mode: "payment",
        settlementConfig: {
          chainName: "SOL",
          networkId: "101",
          tokenAddress: settlementTokenAddress,
          symbol: "USDC",
          tokenDecimals: 6,
        },
        destinationConfig: {
          walletAddress,
        },
        strategy: "cheapest",
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Dynamic API error ${res.status}: ${text}` },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json({ checkoutId: data.id as string });
}
