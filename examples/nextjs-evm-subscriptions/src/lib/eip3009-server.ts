import { hexToSignature, type Address, type Hex } from "viem";
import { z } from "zod";
import { CHAIN_ID, MAX_PULLS, MERCHANT_ADDRESS, PLAN, TOKEN_ADDRESS } from "./config";
import { TRANSFER_WITH_AUTHORIZATION_TYPES, getTokenDomain } from "./eip3009";
import { HttpError, relayerWallet, rpc } from "./permit2-server";
import type { AuthorizationRow } from "./supabase";

// Server side of the EIP-3009 mode: validate what the browser sends, then
// execute the stored authorizations ("direct" from our relayer key, or via
// Relay). Everything from the browser is untrusted.

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "invalid address");
const uint = z.string().regex(/^\d{1,78}$/, "invalid uint");
const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "expected 32 bytes");
// A Relay API path ("/execute/permits", "/intents/status/v3?requestId=…").
// Must start with a single "/" so `${RELAY_BASE}${path}` can never change the
// host (e.g. "@evil.com" or "//evil.com").
const relayPath = z
  .string()
  .max(300)
  .regex(/^\/(?!\/)[A-Za-z0-9/_\-.?=&%]*$/, "invalid Relay path");

export const Eip3009SubscribeBody = z.object({
  mode: z.literal("eip3009"),
  subscriber: address,
  auths: z
    .array(
      z.object({
        executor: z.enum(["direct", "relay"]),
        from: address,
        to: address,
        value: uint,
        validAfter: z.number().int().positive(),
        validBefore: z.number().int().positive(),
        nonce: hex32,
        signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/, "expected a 65-byte signature"),
        relay: z
          .object({
            requestId: z.string().max(128),
            postBody: z.record(z.string(), z.unknown()),
            postEndpoint: relayPath,
            checkEndpoint: relayPath,
          })
          .optional(),
      }),
    )
    .min(1)
    .max(MAX_PULLS.eip3009),
});
export type Eip3009SubscribeBody = z.infer<typeof Eip3009SubscribeBody>;

export type ValidatedEip3009 = {
  subscriber: string;
  merchant: string;
  token: string;
  amount: bigint;
  periodSeconds: number;
  rows: {
    period_index: number;
    from_address: string;
    to_address: string;
    value: string;
    valid_after: number;
    valid_before: number;
    nonce: string;
    signature: string;
    executor: "direct" | "relay";
    relay: Record<string, unknown> | null;
  }[];
};

// Pins the terms server-side: the recipient is the configured merchant, the
// amount and cadence are the plan's, the windows are back-to-back starting
// about now, and (for direct pulls) the signature really is the subscriber's
// over exactly this message. Relay signatures use Relay's own typed data, so
// those can only be verified by Relay at execution time.
export async function validateEip3009Subscription(body: Eip3009SubscribeBody): Promise<ValidatedEip3009> {
  if (!MERCHANT_ADDRESS) throw new HttpError(500, "Merchant address not configured");
  const subscriber = body.subscriber.toLowerCase();
  const merchant = MERCHANT_ADDRESS.toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const first = body.auths[0];

  if (Math.abs(first.validAfter - now) > 10 * 60) {
    throw new HttpError(400, "the first authorization must start about now");
  }
  if (new Set(body.auths.map((a) => a.nonce.toLowerCase())).size !== body.auths.length) {
    throw new HttpError(400, "authorization nonces must be unique");
  }

  const domain = await getTokenDomain();
  const pc = rpc();

  for (const [i, a] of body.auths.entries()) {
    if (a.from.toLowerCase() !== subscriber) throw new HttpError(400, `auths[${i}].from must be the subscriber`);
    if (a.to.toLowerCase() !== merchant) throw new HttpError(400, `auths[${i}].to must be the merchant`);
    if (BigInt(a.value) !== PLAN.amount) throw new HttpError(400, `auths[${i}].value must be the plan amount`);

    if (a.executor === "direct") {
      if (a.validBefore - a.validAfter !== PLAN.periodSeconds) {
        throw new HttpError(400, `auths[${i}] window must be exactly one period`);
      }
      if (a.validAfter !== first.validAfter + i * PLAN.periodSeconds) {
        throw new HttpError(400, `auths[${i}] must start where the previous one ends`);
      }
      const ok = await pc.verifyTypedData({
        address: a.from as Address,
        domain,
        types: TRANSFER_WITH_AUTHORIZATION_TYPES,
        primaryType: "TransferWithAuthorization",
        message: {
          from: a.from as Address,
          to: a.to as Address,
          value: BigInt(a.value),
          validAfter: BigInt(a.validAfter),
          validBefore: BigInt(a.validBefore),
          nonce: a.nonce as Hex,
        },
        signature: a.signature as Hex,
      });
      if (!ok) throw new HttpError(400, `auths[${i}] signature does not match the subscriber`);
    } else {
      if (!a.relay) throw new HttpError(400, `auths[${i}] is a Relay authorization but has no relay payload`);
      if (a.validBefore <= now) throw new HttpError(400, `auths[${i}] has already expired`);
    }
  }

  return {
    subscriber,
    merchant,
    token: TOKEN_ADDRESS,
    amount: PLAN.amount,
    periodSeconds: PLAN.periodSeconds,
    rows: body.auths.map((a, i) => ({
      period_index: i,
      from_address: a.from.toLowerCase(),
      to_address: a.to.toLowerCase(),
      value: a.value,
      valid_after: a.validAfter,
      valid_before: a.validBefore,
      nonce: a.nonce.toLowerCase(),
      signature: a.signature,
      executor: a.executor,
      relay: a.relay ?? null,
    })),
  };
}

// The chain id the authorizations were validated against (for the DB row).
export const EIP3009_CHAIN_ID = CHAIN_ID;

// ── Execution ─────────────────────────────────────────────────────────────

const EIP3009_ABI = [
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
    name: "authorizationState",
    stateMutability: "view",
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export type ExecResult = { ok: true; txHash: string } | { ok: false; error: string };

const oneLine = (err: unknown) => {
  const msg = (err as { shortMessage?: string }).shortMessage ?? (err instanceof Error ? err.message : String(err));
  return msg.split("\n").join(" ").slice(0, 300);
};

// "direct": the relayer key broadcasts transferWithAuthorization. The USDC
// contract enforces the amount, the window and single use; the relayer only
// pays gas.
export async function executeDirect(auth: AuthorizationRow): Promise<ExecResult> {
  if (!auth.signature) return { ok: false, error: "Authorization has no signature" };
  try {
    const pc = rpc();
    // A previous run may have broadcast this one and died before recording it.
    const used = await pc.readContract({
      address: TOKEN_ADDRESS,
      abi: EIP3009_ABI,
      functionName: "authorizationState",
      args: [auth.from_address as Address, auth.nonce as Hex],
    });
    if (used) return { ok: true, txHash: "already-used" };

    const sig = hexToSignature(auth.signature as Hex);
    const v = sig.v ?? BigInt(27 + (sig.yParity ?? 0));
    const hash = await relayerWallet().writeContract({
      address: TOKEN_ADDRESS,
      abi: EIP3009_ABI,
      functionName: "transferWithAuthorization",
      args: [
        auth.from_address as Address,
        auth.to_address as Address,
        BigInt(auth.value),
        BigInt(auth.valid_after),
        BigInt(auth.valid_before),
        auth.nonce as Hex,
        Number(v),
        sig.r,
        sig.s,
      ],
    });
    const receipt = await pc.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") return { ok: false, error: `transfer reverted (${hash})` };
    return { ok: true, txHash: hash };
  } catch (err) {
    return { ok: false, error: oneLine(err) };
  }
}

// "relay": POST the quote-bound body to Relay's /execute/permits with the
// signature as a query parameter (per Relay's step-execution docs), then poll
// the check endpoint until the fill reports success or failure.
export async function executeViaRelay(auth: AuthorizationRow): Promise<ExecResult> {
  const relay = auth.relay as {
    requestId: string;
    postBody: Record<string, unknown>;
    postEndpoint: string;
    checkEndpoint: string;
  } | null;
  if (!relay || !auth.signature) return { ok: false, error: "Missing relay payload on authorization" };
  // Re-validate (the DB is trusted less than code): only paths on Relay's host.
  if (!relayPath.safeParse(relay.postEndpoint).success || !relayPath.safeParse(relay.checkEndpoint).success) {
    return { ok: false, error: "Refusing a Relay endpoint that is not a plain path" };
  }

  const base = process.env.RELAY_API_URL ?? "https://api.relay.link";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.RELAY_API_KEY) headers["x-api-key"] = process.env.RELAY_API_KEY;

  try {
    const res = await fetch(`${base}${relay.postEndpoint}?signature=${encodeURIComponent(auth.signature)}`, {
      method: "POST",
      headers,
      body: JSON.stringify(relay.postBody),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `Relay ${res.status}: ${body?.message ?? res.statusText}` };

    // Poll within the serverless budget (the route allows 60s).
    const deadline = Date.now() + 40_000;
    while (Date.now() < deadline) {
      const status = await fetch(`${base}${relay.checkEndpoint}`, { headers })
        .then((r) => r.json())
        .catch(() => ({}));
      if (status?.status === "success") {
        return { ok: true, txHash: status?.txHashes?.[0] ?? status?.txHash ?? status?.inTxHashes?.[0] ?? `relay:${relay.requestId}` };
      }
      if (status?.status === "failure" || status?.status === "refund") {
        return { ok: false, error: `Relay fill ${status.status}` };
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    // Submitted but not confirmed yet: record it rather than re-submitting.
    return { ok: true, txHash: `relay:${relay.requestId}` };
  } catch (err) {
    return { ok: false, error: oneLine(err) };
  }
}
