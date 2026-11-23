// Shared chain/token config for the demo (Base Sepolia + Circle's USDC).

export const CHAIN_ID = 84532; // Base Sepolia
export const CHAIN_NAME = "Base Sepolia";
export const EXPLORER = "https://sepolia.basescan.org";

// Circle's USDC on Base Sepolia
export const TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_ADDRESS ??
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`;
export const TOKEN_SYMBOL = "USDC";
export const TOKEN_DECIMALS = 6;

// The merchant wallet that receives each pull. It is baked into the deployed
// SubscriptionPlan contract; this is only used for display.
export const MERCHANT_ADDRESS = process.env
  .NEXT_PUBLIC_MERCHANT_ADDRESS as `0x${string}` | undefined;

// Demo plan: $0.10 per period, N pulls for a fixed subscription (or
// "until cancelled"). Amount and period are immutable in the deployed
// contract, so these must match what you deployed it with.
export const PLAN = {
  name: "Hourly USDC Subscription",
  amount: BigInt(process.env.NEXT_PUBLIC_PLAN_AMOUNT ?? "100000"), // 0.10 USDC
  periodSeconds: Number(process.env.NEXT_PUBLIC_PLAN_PERIOD_SECONDS ?? "3600"),
  pulls: Number(process.env.NEXT_PUBLIC_PLAN_PULLS ?? "4"),
};

// Permit2 (Uniswap) is deployed at the same address on every chain.
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

// Deployed SubscriptionPlan contract (see contracts/ and scripts/deploy-plan.mjs).
// Its token, merchant, amount and period are immutable, so the subscriber's
// Permit2 signature binds them. Empty until you deploy it.
export const PLAN_CONTRACT = (process.env.NEXT_PUBLIC_PLAN_CONTRACT || undefined) as
  | `0x${string}`
  | undefined;
