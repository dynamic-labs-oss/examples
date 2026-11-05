/**
 * x402 payment gate.
 *
 * Gates the sample "cloud service" route: it returns HTTP 402 with payment
 * requirements until a valid USDC payment (gasless EIP-3009) is presented. Price
 * is in plain USD; x402 converts it to USDC base units.
 *
 * Network is driven by X402_NETWORK (default "base" / mainnet):
 *  - mainnet ("base") settles via the Coinbase facilitator (@coinbase/x402),
 *    which requires CDP_API_KEY_ID + CDP_API_KEY_SECRET.
 *  - testnet ("base-sepolia") uses the public facilitator (no keys).
 */
import { paymentMiddleware, type Network } from "x402-next";
import { facilitator as coinbaseFacilitator } from "@coinbase/x402";
import { X402_NETWORK } from "@/lib/shared/constants";

const payTo = (process.env.X402_PAY_TO ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

if (!process.env.X402_PAY_TO) {
  console.warn("[x402] X402_PAY_TO is not set — the service route will error.");
}

// Mainnet must use an authenticated facilitator; testnet uses the public one.
const facilitator =
  X402_NETWORK === "base" ? coinbaseFacilitator : undefined;

export const middleware = paymentMiddleware(
  payTo,
  {
    "/api/services/azure-compute": {
      price: "$0.01",
      network: X402_NETWORK as Network,
      config: {
        description: "Provision an Azure-style compute unit (demo resource)",
        mimeType: "application/json",
      },
    },
  },
  facilitator
);

export const config = {
  matcher: ["/api/services/:path*"],
  runtime: "nodejs",
};
