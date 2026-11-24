import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { z } from "zod";
import { PLAN_CONTRACT, PERMIT2_ADDRESS } from "./config";
import { MAX_UINT160, MAX_UINT48, PERMIT2_ABI, PLAN_ABI } from "./permit2";

const MAX_PULLS = 52;

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "invalid address");
const uint = z.string().regex(/^\d{1,78}$/, "invalid uint");

// Request body for POST /api/subscriptions with mode "permit2". Everything
// from the browser is untrusted: it is schema-validated, then re-checked
// against the plan contract's immutables before anything is sent on-chain.
export const Permit2SubscribeBody = z.object({
  subscriber: address,
  permit: z.object({
    details: z.object({
      token: address,
      amount: uint,
      expiration: z.number().int().positive(),
      nonce: z.number().int().nonnegative(),
    }),
    spender: address,
    sigDeadline: uint,
  }),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/, "expected a 65-byte signature"),
});
export type Permit2SubscribeBody = z.infer<typeof Permit2SubscribeBody>;

export function rpc() {
  return createPublicClient({ chain: baseSepolia, transport: http(process.env.RPC_URL) });
}

export function relayerWallet() {
  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (!pk) throw new Error("RELAYER_PRIVATE_KEY is not set");
  return createWalletClient({
    account: privateKeyToAccount(pk as Hex),
    chain: baseSepolia,
    transport: http(process.env.RPC_URL),
  });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type ActivatedPlan = {
  planContract: Address;
  merchant: Address;
  token: Address;
  amount: bigint;
  periodSeconds: number;
  pulls: number | null; // null = open-ended ("until cancelled")
  start: number; // block timestamp of activation = schedule start
  expiration: number;
  txHash: Hex;
};

// Validates the signed permit against the on-chain plan and submits
// plan.subscribe(...) from the relayer. The subscriber's signature — checked
// by Permit2 inside that call — is the only thing authorizing the allowance.
export async function activatePermit2Subscription(body: Permit2SubscribeBody): Promise<ActivatedPlan> {
  if (!PLAN_CONTRACT) throw new HttpError(500, "NEXT_PUBLIC_PLAN_CONTRACT is not configured");
  const plan = PLAN_CONTRACT;
  const pc = rpc();

  if (body.permit.spender.toLowerCase() !== plan.toLowerCase()) {
    throw new HttpError(400, "permit.spender must be the plan contract");
  }

  const [token, merchant, amount, period] = await Promise.all([
    pc.readContract({ address: plan, abi: PLAN_ABI, functionName: "token" }),
    pc.readContract({ address: plan, abi: PLAN_ABI, functionName: "merchant" }),
    pc.readContract({ address: plan, abi: PLAN_ABI, functionName: "amount" }),
    pc.readContract({ address: plan, abi: PLAN_ABI, functionName: "period" }),
  ]);

  if (body.permit.details.token.toLowerCase() !== token.toLowerCase()) {
    throw new HttpError(400, "permit token does not match the plan token");
  }
  const total = BigInt(body.permit.details.amount);
  const now = Math.floor(Date.now() / 1000);
  const periodSeconds = Number(period);

  // Open-ended ("until cancelled"): unlimited amount AND no expiry, together.
  // Anything in between (unlimited amount with a finite expiry, or a finite
  // amount that never expires) is rejected to keep the semantics unambiguous.
  const openEnded = total === MAX_UINT160;
  let pulls: number | null;
  if (openEnded) {
    if (body.permit.details.expiration !== MAX_UINT48) {
      throw new HttpError(400, "an unlimited permit must also have no expiry");
    }
    pulls = null;
  } else {
    if (body.permit.details.expiration === MAX_UINT48) {
      throw new HttpError(400, "a non-expiring permit must use the unlimited amount");
    }
    if (total === 0n || total % amount !== 0n) {
      throw new HttpError(400, "permit amount must be a whole multiple of the per-pull amount");
    }
    pulls = Number(total / amount);
    if (pulls < 1 || pulls > MAX_PULLS) {
      throw new HttpError(400, `pull count must be between 1 and ${MAX_PULLS}`);
    }
    if (body.permit.details.expiration < now + periodSeconds * (pulls - 1)) {
      throw new HttpError(400, "permit expires before the last pull is due");
    }
  }
  if (BigInt(body.permit.sigDeadline) < BigInt(now)) {
    throw new HttpError(400, "permit signature deadline has passed");
  }

  const wallet = relayerWallet();
  const permit = {
    details: {
      token: body.permit.details.token as Address,
      amount: total,
      expiration: body.permit.details.expiration,
      nonce: body.permit.details.nonce,
    },
    spender: body.permit.spender as Address,
    sigDeadline: BigInt(body.permit.sigDeadline),
  };

  let txHash: Hex;
  try {
    // writeContract simulates first, so a bad signature / stale nonce /
    // missing Permit2 approval surfaces as a revert here.
    txHash = await wallet.writeContract({
      address: plan,
      abi: PLAN_ABI,
      functionName: "subscribe",
      args: [body.subscriber as Address, permit, body.signature as Hex],
    });
  } catch (err) {
    // viem's shortMessage keeps the revert reason/selector on one line.
    const msg =
      (err as { shortMessage?: string }).shortMessage ?? (err instanceof Error ? err.message : String(err));
    throw new HttpError(400, `Could not activate permit on-chain: ${msg.split("\n").join(" ").slice(0, 300)}`);
  }
  const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new HttpError(502, `subscribe reverted (${txHash})`);
  const block = await pc.getBlock({ blockNumber: receipt.blockNumber });

  return {
    planContract: plan,
    merchant,
    token,
    amount,
    periodSeconds,
    pulls,
    start: Number(block.timestamp),
    expiration: body.permit.details.expiration,
    txHash,
  };
}

// True once Permit2 no longer lets `plan` (the subscription's own plan
// contract, not necessarily the one currently configured) move this wallet's
// funds: revoked, used up, or expired.
export async function isAllowanceRevoked(
  subscriber: Address,
  token: Address,
  plan: string | null | undefined,
): Promise<boolean> {
  if (!plan) return true;
  const [amount, expiration] = await rpc().readContract({
    address: PERMIT2_ADDRESS,
    abi: PERMIT2_ABI,
    functionName: "allowance",
    args: [subscriber, token, plan as Address],
  });
  return amount === 0n || expiration <= Math.floor(Date.now() / 1000);
}
