# Agentic payments with Dynamic + x402 (crypto, abstracted)

A production-shaped demo of **agentic payments that hide all the crypto**. A user
signs in, "adds funds" in USD (via a MoonPay card top-up), and authorizes an
agent. The agent then **pays for services on the user's behalf** using
[x402](https://x402.org) — gasless USDC payments signed inside Dynamic's MPC, so
no private keys ever touch the agent and the user never sees a seed phrase, gas
fee, or token symbol.

> "Stablecoins between agents, on existing rails": the user experience is a
> dollar balance and a card top-up; the settlement layer is stablecoins over HTTP 402.

Built on the **Dynamic JS SDK** (`@dynamic-labs-sdk/*` + react-hooks), like
`nextjs-stablecoin-yield-aave`.

## What's in the box

| Piece | Path | Role |
| --- | --- | --- |
| **Website** | `app/`, `components/flow/`, `lib/providers.tsx` | Email sign-in → embedded wallet (guarded) → authorize → fund. USD-framed, light theme. |
| **Delegation webhook** | `app/api/webhooks/dynamic/`, `lib/dynamic/` | Verifies + receives `wallet.delegation.created`, decrypts the share (RSA-OAEP + AES-GCM). |
| **Encrypted store** | `lib/shared/delegation-store.ts`, `supabase/` | Re-encrypts shares (AES-256-GCM) into Supabase; derives a short **account code** per wallet. |
| **Account API** | `app/api/account/`, `app/api/balance/` | Account code + USD balance for the UI. |
| **Paid service** | `middleware.ts`, `app/api/services/azure-compute/` | An "Azure-style" resource gated behind x402 (priced in USD). |
| **Agent** | `agent/pay-for-service.ts` | Resolves a user's wallet **by account code**, pays the service via x402 (gasless). |

## How it works

```
                    Website (Dynamic JS SDK)
  user ──email sign-in──▶ embedded EVM wallet ──authorize──▶ delegateWaasKeyShares
                                                              │
                          Dynamic webhook (wallet.delegation.created)
                                                              │  RSA-decrypt
                                                              ▼  AES-256-GCM encrypt
                                                       Supabase (encrypted share + code)
                                                              │
   agent <accountCode> ──────────────────────────────────────┘
     │   check USD balance ──(empty)──▶ point user to funding page
     │   pay x402 service  ──sign EIP-3009 via Dynamic MPC (gasless)──▶ facilitator settles USDC
     ▼
   "Azure compute unit provisioned. Charged $0.01."
```

The agent never holds a key. x402's `exact` scheme only needs an EIP-712
signature, which `lib/shared/x402-account.ts` produces by routing viem's
`signTypedData` to Dynamic's `delegatedSignTypedData`.

**User ↔ wallet mapping.** Each delegation gets a short, stable **account code**
(derived from the wallet address, stored in Supabase). The funding page shows it;
the agent is told which user to act for by that code (`pnpm agent <code>`) — no
hardcoded addresses.

## Network

Defaults to **Base mainnet** (`X402_NETWORK=base`), settled by the **Coinbase
facilitator** (`@coinbase/x402`, needs `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET`).
Set `X402_NETWORK=base-sepolia` for testnet dev — that uses the public facilitator
(`https://x402.org/facilitator`, no keys). USDC address/chain switch automatically
(`lib/shared/constants.ts`).

## Setup

1. **Install**: `pnpm install`

2. **Dynamic** ([dashboard](https://app.dynamic.xyz), use a **live** env for prod):
   - Enable embedded wallets + delegated access + email login.
   - Create an API token.
   - Generate the delegation keypair, upload the **public** key (delegated-access encryption key):
     ```bash
     openssl genrsa -out private-key.pem 3072
     openssl rsa -in private-key.pem -pubout -out public-key.pem
     ```
   - Add a webhook → `https://<your-domain>/api/webhooks/dynamic`, events
     `wallet.delegation.created` + `wallet.delegation.revoked`; copy the signing secret.

3. **Supabase**: create a project, run migrations, grab the URL + service-role key:
   ```bash
   supabase db push --db-url "$SUPABASE_DB_URL"   # applies supabase/migrations/*
   ```

4. **Coinbase CDP** (mainnet only): create API keys at
   [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) → `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET`.

5. **Env**: `cp .env.example .env` and fill it in.
   ```bash
   openssl rand -hex 32   # → DELEGATION_ENCRYPTION_KEY
   ```

6. **Run**: `pnpm dev` → http://localhost:3000

## Demo flow

1. **Sign in** with email (embedded wallet created silently, guarded so it's never duplicated).
2. **Authorize your agent** — delegated access; the webhook stores the encrypted share in Supabase.
3. **Add funds** — hosted on-ramp card top-up on mainnet (`NEXT_PUBLIC_ONRAMP_URL`, e.g. MoonPay/Coinbase/Crypto.com), faucet on testnet. Balance shows in USD. Note your **account code**.
4. **Run the agent** for that account:
   ```bash
   pnpm agent <accountCode>          # or a 0x address, or set AGENT_ACCOUNT
   ```
   ```
   Account EA8CD66A → wallet 0x…
   Balance: $25.00
   💳 Paying for service: …/api/services/azure-compute
   ✅ Service delivered (paid $0.01): { status: "provisioned", … }
   ```
   Empty balance → the agent prints the funding URL instead.

## Deploy (Vercel)

```bash
vercel link        # link the project
# set the env vars from .env in the Vercel dashboard (or `vercel env add` each)
vercel --prod
```
Then:
- **Disable Deployment Protection** for production (Project Settings → Deployment
  Protection → Vercel Authentication → off) so the site is public and the webhook
  endpoint is reachable.
- Point the Dynamic webhook at `https://<your-vercel-domain>/api/webhooks/dynamic`.
- Set `FUNDING_URL` / `X402_SERVICE_URL` to the deployed domain. Run the agent
  from any server with the same env (it talks to Supabase + the deployed service).

> **npm registry:** this example pins the public npm registry via `.npmrc`. The
> Dynamic JS SDK is pinned to **1.2.1** (`react-hooks` 0.26.5) — the versions fully
> published to public npm (newer 1.8.x deps are only on Dynamic's internal registry,
> which a CI/Vercel build can't reach).

## Security notes

- **No plaintext key material at rest.** Shares arrive RSA-encrypted from Dynamic,
  are decrypted server-side, then re-encrypted with AES-256-GCM
  (`DELEGATION_ENCRYPTION_KEY`) before Supabase. The table has RLS on with no
  public policies — only the service-role key reads it.
- **No raw keys in the agent.** All signing is inside Dynamic's MPC.
- **Gasless.** x402 payments are EIP-3009 `transferWithAuthorization` — the
  facilitator pays gas; the user pays only the stablecoin amount.
- **Webhook auth.** Incoming webhooks are signature-verified (`DYNAMIC_WEBHOOK_SECRET`).
- **Secrets via env only.** `.env*` and `*.pem` are gitignored. For production,
  prefer a KMS/HSM for the RSA + at-rest keys and decrypt on demand; rotate keys;
  use the Dynamic **live** env and least-privilege Supabase access.
- Revocation: `wallet.delegation.revoked` deletes the stored share, so the agent
  can no longer act.
