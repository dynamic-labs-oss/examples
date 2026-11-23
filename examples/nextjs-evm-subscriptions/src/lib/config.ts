// Shared chain/token config for the demo. Base Sepolia USDC implements
// EIP-3009 transferWithAuthorization, which is what makes gasless pulls work.

export const CHAIN_ID = 84532; // Base Sepolia
export const CHAIN_NAME = "Base Sepolia";
export const EXPLORER = "https://sepolia.basescan.org";

// Circle's USDC on Base Sepolia
export const TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_ADDRESS ??
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`;
export const TOKEN_SYMBOL = "USDC";
export const TOKEN_DECIMALS = 6;

// The merchant wallet that receives each pull. Defaults are meaningless in
// production — set NEXT_PUBLIC_MERCHANT_ADDRESS to a wallet you control.
export const MERCHANT_ADDRESS = process.env
  .NEXT_PUBLIC_MERCHANT_ADDRESS as `0x${string}` | undefined;

// Demo plan: $0.10 per period, N pulls total. Period defaults to 1 hour.
export const PLAN = {
  name: "Hourly USDC Subscription",
  amount: BigInt(process.env.NEXT_PUBLIC_PLAN_AMOUNT ?? "100000"), // 0.10 USDC
  periodSeconds: Number(process.env.NEXT_PUBLIC_PLAN_PERIOD_SECONDS ?? "3600"),
  pulls: Number(process.env.NEXT_PUBLIC_PLAN_PULLS ?? "4"),
};

export const EIP3009_ABI = [
  {
    type: "function",
    name: "transferWithAuthorization",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "version",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "authorizationState",
    stateMutability: "view",
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;
