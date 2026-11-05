import { type NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, isAddress } from "viem";
import {
  ERC20_BALANCE_ABI,
  RPC_URL,
  USDC_ADDRESS,
  VIEM_CHAIN,
  formatUsd,
} from "@/lib/shared/constants";

/**
 * Returns a wallet's spendable balance as plain USD.
 *
 * Reads the on-chain USDC balance on the configured network (Base mainnet by
 * default) and formats it as dollars — the UI never mentions tokens or chains.
 * On-chain balances are public, so no auth is required.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: "A valid `address` query param is required" },
      { status: 400 }
    );
  }

  const client = createPublicClient({
    chain: VIEM_CHAIN,
    transport: http(RPC_URL),
  });

  try {
    const balance = await client.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
    return NextResponse.json({ address, usd: formatUsd(balance) });
  } catch (err) {
    // Log details server-side; return a generic message so RPC/infra details
    // aren't leaked to the client.
    console.error("Balance read failed:", err);
    return NextResponse.json({ error: "Failed to read balance" }, { status: 502 });
  }
}
