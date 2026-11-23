# EVM Subscriptions with Dynamic

A Next.js demo that replicates the [Solana subscriptions](../nextjs-solana-subscriptions) flow on EVM: a user **signs once** and a relayer pulls a recurring payment (default **$0.10 USDC per hour**) from their wallet — external wallets (MetaMask, WalletConnect) and Dynamic embedded wallets both work.

## How it works

EVM has no on-chain subscription program equivalent to Solana's delegation PDA, so the demo uses **EIP-3009 `transferWithAuthorization`** on USDC (Base Sepolia):

1. **Subscribe**: the app builds `N` EIP-712 `TransferWithAuthorization` messages — one per billing period, each with a unique nonce and its own `validAfter`/`validBefore` window — and the user signs all of them with their wallet. No gas, no on-chain transaction.
2. **Store**: the signatures land in Supabase alongside the subscription record.
3. **Collect**: `POST /api/cron/collect` (wired to a Vercel cron every 5 minutes, plus a "Collect due pulls" button) broadcasts each authorization whose window is open. The USDC contract itself enforces amount, window, and single-use nonce — a pull cannot be replayed or taken early.
4. **Cancel**: marks the subscription cancelled and voids pending authorizations; already-broadcast pulls are unaffected — the same semantics as the Solana cancel flow.

### Two executors

- **Direct (default)** — a relayer key you fund with Base Sepolia ETH broadcasts `transferWithAuthorization`. Works on testnet today.
- **Relay** — at subscribe time the app instead requests a Relay quote with `usePermit: true`, signs the EIP-712 signature step it returns, and stores the quote's `post` body. The collector POSTs it to `/execute/permits` and polls the check endpoint. Relay-bound subscriptions require a solver-supported route — USDC works on mainnet; Relay's testnet solvers currently carry no USDC, so the demo defaults to direct mode on Base Sepolia.

## Setup

```bash
cp .env.example .env.local
# Fill in your values
pnpm install
pnpm dev
```

Run `supabase/schema.sql` in your Supabase project's SQL editor first.

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_DYNAMIC_ENV_ID` | Yes | Dynamic environment ID from [app.dynamic.xyz](https://app.dynamic.xyz) |
| `NEXT_PUBLIC_MERCHANT_ADDRESS` | Yes | Merchant EVM address that receives each pull |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | Yes | Supabase project URL and secret API key — server only |
| `RELAYER_PRIVATE_KEY` | Yes (direct mode) | Key that broadcasts `transferWithAuthorization`; fund with Base Sepolia ETH |
| `NEXT_PUBLIC_RPC_URL` / `RPC_URL` | No | Base Sepolia RPC override |
| `CRON_SECRET` | No | When set, `/api/cron/collect` requires `Authorization: Bearer <secret>` |
| `NEXT_PUBLIC_PLAN_*` | No | Override amount (default 0.10 USDC), period (default 3600s), pull count (default 4) |
| `RELAY_API_URL` / `RELAY_API_KEY` | No | Relay executor config (mainnet) |

### Dynamic dashboard

1. Enable **EVM** under Chains & Networks
2. Enable **Embedded wallets** under Wallets (for the embedded-wallet path)
3. Enable **Email OTP** and/or **Google** under Sign-in Methods
4. Add `http://localhost:3000` under Security → Allowed Origins

## What this proves — and what production needs

- **Proven**: a single signing session produces N independent pull authorizations; a scheduler executes them on time with no further user interaction; the token contract enforces the cadence.
- **Production options** for true open-ended subscriptions:
  - Sign per period (user signs each billing cycle — simplest UX change).
  - A Permit2 `PermitSingle` allowance signature to a subscription contract that enforces the monthly cadence — the closest analog of Solana's delegation PDA.
  - Relay executes each pull on mainnet by binding signatures to fresh quotes (this example's `relay` executor mode).

## Resources

- [Solana Subscriptions example](../nextjs-solana-subscriptions)
- [Relay step execution docs](https://docs.relay.link/references/api/api_core_concepts/step-execution#signature-steps)
- [EIP-3009: transfer with authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [Dynamic JS SDK](https://docs.dynamic.xyz/javascript/reference/quickstart)
