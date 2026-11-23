import {
  createPublicClient,
  http,
  maxUint256,
  type Address,
  type Hex,
  type WalletClient,
} from "viem";
import { baseSepolia } from "viem/chains";
import { CHAIN_ID, PERMIT2_ADDRESS, PLAN, PLAN_CONTRACT, TOKEN_ADDRESS } from "./config";

// ── ABIs (just the slices this demo uses) ─────────────────────────────────

export const PERMIT2_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
  {
    // Owner-called: sets (amount, expiration). approve(token, spender, 0, 0)
    // is the on-chain "cancel subscription".
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export const PLAN_ABI = [
  {
    type: "function",
    name: "subscribe",
    stateMutability: "nonpayable",
    inputs: [
      { name: "subscriber", type: "address" },
      {
        name: "permit",
        type: "tuple",
        components: [
          {
            name: "details",
            type: "tuple",
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint160" },
              { name: "expiration", type: "uint48" },
              { name: "nonce", type: "uint48" },
            ],
          },
          { name: "spender", type: "address" },
          { name: "sigDeadline", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "pull",
    stateMutability: "nonpayable",
    inputs: [{ name: "subscriber", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "nextPullAt",
    stateMutability: "view",
    inputs: [{ name: "subscriber", type: "address" }],
    outputs: [{ type: "uint48" }],
  },
  { type: "function", name: "token", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "merchant", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "amount", stateMutability: "view", inputs: [], outputs: [{ type: "uint160" }] },
  { type: "function", name: "period", stateMutability: "view", inputs: [], outputs: [{ type: "uint48" }] },
] as const;

// ── Permit2 EIP-712 ───────────────────────────────────────────────────────

// "Unlimited" sentinels for open-ended subscriptions.
export const MAX_UINT160 = 2n ** 160n - 1n;
export const MAX_UINT48 = 2 ** 48 - 1;

export const PERMIT_SINGLE_TYPES = {
  PermitSingle: [
    { name: "details", type: "PermitDetails" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
} as const;

// Permit2's EIP-712 domain has no version and no chain-specific salt.
export const permit2Domain = {
  name: "Permit2",
  chainId: CHAIN_ID,
  verifyingContract: PERMIT2_ADDRESS,
} as const;

export type PermitSingleMessage = {
  details: { token: Address; amount: bigint; expiration: number; nonce: number };
  spender: Address;
  sigDeadline: bigint;
};

function client() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL),
  });
}

// Browser-side read client (balances, allowances).
export const publicClient = client;

// ── Client-side flow ──────────────────────────────────────────────────────

// One-time per token & wallet: let Permit2 move this token. The only
// on-chain transaction the subscriber ever sends to subscribe.
export async function ensurePermit2Approval({
  walletClient,
  owner,
  minAmount,
}: {
  walletClient: WalletClient;
  owner: Address;
  minAmount: bigint;
}): Promise<Hex | null> {
  const pc = client();
  const current = await pc.readContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, PERMIT2_ADDRESS],
  });
  if (current >= minAmount) return null;

  const hash = await walletClient.writeContract({
    account: owner,
    chain: baseSepolia,
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [PERMIT2_ADDRESS, maxUint256],
  });
  await pc.waitForTransactionReceipt({ hash });
  return hash;
}

// Sign ONE PermitSingle: allowance of `amount × pulls` for the plan contract,
// valid until the schedule ends. The plan contract's immutables (merchant,
// per-pull amount, period) are what bind the terms — the spender address is
// the commitment.
export async function signPlanPermit({
  walletClient,
  owner,
  pulls = PLAN.pulls,
  amountPerPull = PLAN.amount,
  periodSeconds = PLAN.periodSeconds,
  openEnded = false,
}: {
  walletClient: WalletClient;
  owner: Address;
  pulls?: number;
  amountPerPull?: bigint;
  periodSeconds?: number;
  // true → "until cancelled": an unlimited, non-expiring allowance. The plan
  // contract still only pays amountPerPull to the merchant once per period.
  openEnded?: boolean;
}): Promise<{ permit: PermitSingleMessage; signature: Hex }> {
  if (!PLAN_CONTRACT) throw new Error("NEXT_PUBLIC_PLAN_CONTRACT is not set — deploy the plan contract first");

  const pc = client();
  // Permit2 keeps a per-(owner, token, spender) nonce the signature must match.
  const [, , nonce] = await pc.readContract({
    address: PERMIT2_ADDRESS,
    abi: PERMIT2_ABI,
    functionName: "allowance",
    args: [owner, TOKEN_ADDRESS, PLAN_CONTRACT],
  });

  const now = Math.floor(Date.now() / 1000);
  const permit: PermitSingleMessage = {
    details: {
      token: TOKEN_ADDRESS,
      // Permit2 treats amount = 2^160-1 as unlimited (never decremented).
      amount: openEnded ? MAX_UINT160 : amountPerPull * BigInt(pulls),
      // Finite: the allowance dies right after the last period. Open-ended:
      // 2^48-1 (never expires). NOT 0 — in Permit2, expiration 0 means
      // "expires at the current block".
      expiration: openEnded ? MAX_UINT48 : now + periodSeconds * pulls,
      nonce,
    },
    spender: PLAN_CONTRACT,
    sigDeadline: BigInt(now + 30 * 60),
  };

  const signature = await walletClient.signTypedData({
    account: owner,
    domain: permit2Domain,
    types: PERMIT_SINGLE_TYPES,
    primaryType: "PermitSingle",
    message: permit,
  });
  return { permit, signature };
}

// On-chain cancel: zero the allowance. After this the plan contract can't
// pull anything, regardless of what the server or database says.
export async function revokePlanAllowance({
  walletClient,
  owner,
  plan,
}: {
  walletClient: WalletClient;
  owner: Address;
  // The subscription's own plan contract (not just the currently configured one).
  plan: Address;
}): Promise<Hex> {
  const hash = await walletClient.writeContract({
    account: owner,
    chain: baseSepolia,
    address: PERMIT2_ADDRESS,
    abi: PERMIT2_ABI,
    functionName: "approve",
    args: [TOKEN_ADDRESS, plan, 0n, 0],
  });
  await client().waitForTransactionReceipt({ hash });
  return hash;
}
