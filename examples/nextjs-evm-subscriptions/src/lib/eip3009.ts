// Shared by the browser (signing) and the server (verifying), so this module
// must not be marked "use client".
import { toHex, type WalletClient } from "viem";
import { CHAIN_ID, MERCHANT_ADDRESS, PLAN, TOKEN_ADDRESS } from "./config";
import { publicClient } from "./permit2";

// EIP-3009 mode: instead of one Permit2 allowance, the subscriber signs one
// `TransferWithAuthorization` per billing period. Each has its own nonce and
// validAfter/validBefore window, so the USDC contract itself enforces the
// amount, the window and single use. Anyone holding a signature can broadcast
// it during its window, which is what the relayer (or Relay) does.

// One stored, pre-signed authorization per billing period.
export type SignedAuthorization = {
  executor: "direct" | "relay";
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: `0x${string}`;
  signature: `0x${string}`;
  // relay executor: the quote-bound post body from the signature step. The
  // collector POSTs it to Relay /execute/permits with ?signature= and polls
  // the check endpoint.
  relay?: {
    requestId: string;
    postBody: Record<string, unknown>;
    postEndpoint: string;
    checkEndpoint: string;
  };
};

export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

const TOKEN_META_ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "version", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

// The token's EIP-712 domain. Read from the token itself (name/version), so it
// stays right if NEXT_PUBLIC_TOKEN_ADDRESS points at another EIP-3009 token.
export async function getTokenDomain() {
  const client = publicClient();
  const [name, version] = await Promise.all([
    client.readContract({ address: TOKEN_ADDRESS, abi: TOKEN_META_ABI, functionName: "name" }),
    client.readContract({ address: TOKEN_ADDRESS, abi: TOKEN_META_ABI, functionName: "version" }).catch(() => "2"),
  ]);
  return { name, version, chainId: CHAIN_ID, verifyingContract: TOKEN_ADDRESS };
}

// Direct mode: sign `pulls` EIP-3009 messages, one per period, each valid only
// inside its own window. The same "authorize once, pull per period" guarantee
// Solana's SubscriptionDelegation gives on-chain, but N signatures up front.
export async function signPlanAuthorizations({
  walletClient,
  pulls = PLAN.pulls,
  periodSeconds = PLAN.periodSeconds,
  amount = PLAN.amount,
}: {
  walletClient: WalletClient;
  pulls?: number;
  periodSeconds?: number;
  amount?: bigint;
}): Promise<SignedAuthorization[]> {
  if (!MERCHANT_ADDRESS) throw new Error("NEXT_PUBLIC_MERCHANT_ADDRESS is not set");
  const from = walletClient.account?.address;
  if (!from) throw new Error("Wallet has no account");

  const domain = await getTokenDomain();
  const start = Math.floor(Date.now() / 1000);
  const auths: SignedAuthorization[] = [];

  for (let i = 0; i < pulls; i++) {
    const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)), { size: 32 });
    const validAfter = start + i * periodSeconds;
    const validBefore = validAfter + periodSeconds;
    const signature = await walletClient.signTypedData({
      account: from,
      domain,
      types: TRANSFER_WITH_AUTHORIZATION_TYPES,
      primaryType: "TransferWithAuthorization",
      message: {
        from,
        to: MERCHANT_ADDRESS,
        value: amount,
        validAfter: BigInt(validAfter),
        validBefore: BigInt(validBefore),
        nonce,
      },
    });
    auths.push({
      executor: "direct",
      from,
      to: MERCHANT_ADDRESS,
      value: amount.toString(),
      validAfter,
      validBefore,
      nonce,
      signature,
    });
  }
  return auths;
}

// Relay mode: for each period, ask Relay for a quote with usePermit and sign
// the EIP-712 signature step it returns. Relay's solver then executes the pull
// and settles to the merchant. Relay only supports this where the currency is
// solver-listed (mainnet USDC works; testnets currently carry no USDC), and the
// permit is bounded by the quote's expiry (about a day), so Relay-bound
// subscriptions are meant for mainnet runs.
export async function signRelayAuthorizations({
  walletClient,
  pulls = PLAN.pulls,
  amount = PLAN.amount,
}: {
  walletClient: WalletClient;
  pulls?: number;
  amount?: bigint;
}): Promise<SignedAuthorization[]> {
  if (!MERCHANT_ADDRESS) throw new Error("NEXT_PUBLIC_MERCHANT_ADDRESS is not set");
  const from = walletClient.account?.address;
  if (!from) throw new Error("Wallet has no account");

  const base = process.env.NEXT_PUBLIC_RELAY_API_URL ?? "https://api.relay.link";
  const auths: SignedAuthorization[] = [];

  for (let i = 0; i < pulls; i++) {
    const quote = await fetch(`${base}/quote/v2`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        user: from,
        recipient: MERCHANT_ADDRESS,
        originChainId: CHAIN_ID,
        destinationChainId: CHAIN_ID,
        originCurrency: TOKEN_ADDRESS,
        destinationCurrency: TOKEN_ADDRESS,
        amount: amount.toString(),
        tradeType: "EXACT_INPUT",
        usePermit: true,
      }),
    }).then(async (r) => {
      const body = await r.json();
      if (!r.ok) throw new Error(`Relay quote failed: ${body?.message ?? r.status}`);
      return body;
    });

    const items = (quote.steps ?? []).flatMap(
      (s: { kind?: string; items?: unknown[] }) => (s.kind === "signature" ? (s.items ?? []) : []),
    );
    const requestId: string = quote.steps?.[0]?.items?.[0]?.data?.post?.body?.requestId ?? quote.requestId;
    if (items.length === 0) {
      throw new Error("Relay quote returned no signature step (permit not available for this route)");
    }

    const it = items[0] as {
      data: {
        sign: {
          domain: Record<string, unknown>;
          types: Record<string, unknown>;
          primaryType: string;
          value: Record<string, unknown>;
        };
        post: { endpoint: string; body: Record<string, unknown> };
      };
      check?: { endpoint: string };
    };
    const { sign, post } = it.data;
    const signature = await walletClient.signTypedData({
      account: from,
      domain: sign.domain,
      types: sign.types,
      primaryType: sign.primaryType,
      message: sign.value,
    } as Parameters<WalletClient["signTypedData"]>[0]);

    const v = sign.value as {
      validAfter?: number | string;
      validBefore?: number | string;
      nonce?: string;
      to?: string;
      value?: string | number;
    };
    auths.push({
      executor: "relay",
      from,
      to: (v.to ?? MERCHANT_ADDRESS) as `0x${string}`,
      value: String(v.value ?? amount),
      validAfter: Number(v.validAfter ?? 0),
      validBefore: Number(v.validBefore ?? 0),
      nonce: (v.nonce ?? "0x0") as `0x${string}`,
      signature: signature as `0x${string}`,
      relay: {
        requestId,
        postBody: post.body,
        postEndpoint: post.endpoint,
        checkEndpoint: it.check?.endpoint ?? `/intents/status/v3?requestId=${requestId}`,
      },
    });
  }
  return auths;
}
