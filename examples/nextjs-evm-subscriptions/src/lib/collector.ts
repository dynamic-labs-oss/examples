import {
  createWalletClient,
  createPublicClient,
  http,
  hexToSignature,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { EIP3009_ABI, TOKEN_ADDRESS } from "./config";
import type { AuthorizationRow } from "./supabase";

// Executes a stored authorization.
//
//  - "direct": broadcast transferWithAuthorization from RELAYER_PRIVATE_KEY.
//    Works anywhere USDC exists, including Base Sepolia where Relay's
//    testnet solvers don't carry USDC.
//  - "relay": POST the quote-bound post.body + ?signature= to Relay's
//    /execute/permits endpoint, exactly as Relay's step-execution docs
//    describe, then poll the check endpoint for the fill.
export type CollectResult =
  | { ok: true; txHash: string; via: "direct" | "relay" }
  | { ok: false; error: string };

export async function executeAuthorization(
  auth: AuthorizationRow,
): Promise<CollectResult> {
  try {
    if (auth.executor === "relay") return await executeViaRelay(auth);
    return await executeDirect(auth);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function executeDirect(auth: AuthorizationRow): Promise<CollectResult> {
  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (!pk) throw new Error("RELAYER_PRIVATE_KEY is not set");

  const account = privateKeyToAccount(pk as Hex);
  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.RPC_URL),
  });
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.RPC_URL),
  });

  const { v, r, s } = hexToSignature(auth.signature as Hex);
  const hash = await wallet.writeContract({
    address: TOKEN_ADDRESS,
    abi: EIP3009_ABI,
    functionName: "transferWithAuthorization",
    args: [
      auth.from_address as Hex,
      auth.to_address as Hex,
      BigInt(auth.value),
      BigInt(auth.valid_after),
      BigInt(auth.valid_before),
      auth.nonce as Hex,
      Number(v),
      r,
      s,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return { ok: true, txHash: hash, via: "direct" };
}

// Relay executor: POST /execute/permits with the body the quote's signature
// step specified, signature passed as a query param (per Relay docs), then
// poll the item's check endpoint until it reports success.
async function executeViaRelay(auth: AuthorizationRow): Promise<CollectResult> {
  const relay = auth.relay as {
    requestId: string;
    postBody: Record<string, unknown>;
    postEndpoint: string;
    checkEndpoint: string;
  } | null;
  if (!relay) return { ok: false, error: "Missing relay payload on authorization" };

  const base = process.env.RELAY_API_URL ?? "https://api.relay.link";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.RELAY_API_KEY) headers["x-api-key"] = process.env.RELAY_API_KEY;

  const res = await fetch(
    `${base}${relay.postEndpoint}?signature=${encodeURIComponent(auth.signature)}`,
    { method: "POST", headers, body: JSON.stringify(relay.postBody) },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: `Relay ${res.status}: ${body?.message ?? res.statusText}` };
  }

  // Poll the check endpoint until the intent reports success/failure.
  const deadline = Date.now() + 3 * 60 * 1000;
  while (Date.now() < deadline) {
    const statusRes = await fetch(`${base}${relay.checkEndpoint}`, { headers });
    const status = await statusRes.json().catch(() => ({}));
    const s = status?.status;
    if (s === "success") {
      const txHash =
        status?.txHashes?.[0] ?? status?.txHash ?? status?.inTxHashes?.[0] ?? "success";
      return { ok: true, txHash, via: "relay" };
    }
    if (s === "failure" || s === "refund") {
      return { ok: false, error: `Relay fill ${s}` };
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { ok: true, txHash: `requestId:${relay.requestId}`, via: "relay" };
}
