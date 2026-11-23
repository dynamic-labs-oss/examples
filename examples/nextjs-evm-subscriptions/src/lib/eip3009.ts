"use client";

import { createPublicClient, http, toHex, type WalletClient } from "viem";
import { baseSepolia } from "viem/chains";
import { CHAIN_ID, CHAIN_NAME, EIP3009_ABI, MERCHANT_ADDRESS, PLAN, TOKEN_ADDRESS } from "./config";

// One stored, pre-signed authorization per billing period.
export type SignedAuthorization = {
  executor: "direct" | "relay";
  // direct mode: raw EIP-3009 authorization, broadcast later by the relayer key
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: `0x${string}`;
  signature: `0x${string}`;
  // relay mode: quote-bound Relay permit — post body from the signature step
  // plus the signature the user produced for it. Executed by POSTing
  // post.body + ?signature= to Relay /execute/permits, then polling check.
  relay?: {
    requestId: string;
    postBody: Record<string, unknown>;
    postEndpoint: string;
    checkEndpoint: string;
  };
};

const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export function publicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL),
  });
}

export async function getTokenDomain() {
  const client = publicClient();
  const [name, version] = await Promise.all([
    client.readContract({
      address: TOKEN_ADDRESS,
      abi: EIP3009_ABI,
      functionName: "name",
    }),
    client
      .readContract({
        address: TOKEN_ADDRESS,
        abi: EIP3009_ABI,
        functionName: "version",
      })
      .catch(() => "2"),
  ]);
  return { name, version, chainId: CHAIN_ID, verifyingContract: TOKEN_ADDRESS };
}

async function ensureChain(walletClient: WalletClient) {
  if (walletClient.chain?.id !== CHAIN_ID) {
    try {
      await walletClient.switchChain({ id: CHAIN_ID });
    } catch {
      throw new Error(`Switch your wallet to ${CHAIN_NAME} to subscribe.`);
    }
  }
}

// Direct mode: sign `pulls` EIP-3009 TransferWithAuthorization messages, one
// per period, each with its own nonce and validity window. Anyone (our
// relayer, the merchant, Relay) can broadcast them during their window —
// the same "authorize once, pull per period" guarantee Solana's
// SubscriptionDelegation PDA gives on-chain.
export async function signPlanAuthorizations({
  walletClient,
  pulls = PLAN.pulls,
  periodSeconds = PLAN.periodSeconds,
  amount = PLAN.amount,
  firstPullDelaySeconds = 0,
}: {
  walletClient: WalletClient;
  pulls?: number;
  periodSeconds?: number;
  amount?: bigint;
  firstPullDelaySeconds?: number;
}): Promise<SignedAuthorization[]> {
  if (!MERCHANT_ADDRESS) throw new Error("NEXT_PUBLIC_MERCHANT_ADDRESS is not set");
  const from = walletClient.account?.address;
  if (!from) throw new Error("Wallet has no account");
  await ensureChain(walletClient);

  const domain = await getTokenDomain();
  const now = Math.floor(Date.now() / 1000);
  const start = now + firstPullDelaySeconds;
  const auths: SignedAuthorization[] = [];

  for (let i = 0; i < pulls; i++) {
    const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)), { size: 32 });
    const validAfter = start + i * periodSeconds;
    const validBefore = validAfter + periodSeconds;
    const message = {
      from,
      to: MERCHANT_ADDRESS,
      value: amount,
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce,
    };

    const signature = await walletClient.signTypedData({
      account: from,
      domain,
      types: TRANSFER_WITH_AUTHORIZATION_TYPES,
      primaryType: "TransferWithAuthorization",
      message,
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

// Relay mode: for each period, request a Relay quote with usePermit and sign
// the EIP-712 signature step it returns. The signature pays Relay's approval
// proxy, and Relay's solver executes the pull and settles to the merchant.
// Relay only supports this on chains where the currency is solver-listed —
// mainnet USDC works; testnets currently carry no USDC, so this mode is for
// mainnet runs. validBefore comes from Relay's quote (bounded by
// permitExpiry, max ~24h), which is why Relay-bound subscriptions are
// created per-run rather than far in advance.
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
  await ensureChain(walletClient);

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
    const authsForQuote: SignedAuthorization[] = [];

    for (const item of items) {
      const it = item as {
        data: {
          sign: {
            signatureKind: string;
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

      const v = sign.value as { validAfter?: number | string; validBefore?: number | string; nonce?: string; to?: string; value?: string | number };
      authsForQuote.push({
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

    if (authsForQuote.length === 0) {
      throw new Error("Relay quote returned no signature step (permit not available for this route)");
    }
    auths.push(...authsForQuote.slice(0, 1));
  }

  return auths;
}
