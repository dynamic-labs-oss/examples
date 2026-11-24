# EVM Subscriptions with Dynamic

A Next.js demo of recurring pull payments on **EVM (Base Sepolia)** and **Solana (devnet)**, switchable from the header of the subscribe and subscriptions pages. A user **signs once** and a contract or program that enforces the schedule pulls a recurring payment (default **$0.10 USDC per hour**) from their wallet. External wallets (MetaMask, Phantom, WalletConnect) and Dynamic embedded wallets both work.

- **EVM** — Permit2 allowance + a cadence-enforcing `SubscriptionPlan` contract (sections below). Collection state lives in Supabase.
- **Solana** — the [Solana Subscriptions program](https://solana.com/docs/payments/subscriptions/overview) (already deployed; nothing for you to deploy). See [Solana](#solana-devnet).

## How it works

EVM has no on-chain subscription program like Solana's delegation PDA, so this demo builds the equivalent from two pieces:

- **[Permit2](https://github.com/Uniswap/permit2)** — Uniswap's canonical allowance contract, already deployed at `0x0000…8BA3` on every chain. The subscriber signs **one** `PermitSingle` granting an allowance to a spender.
- **`SubscriptionPlan`** (`contracts/SubscriptionPlan.sol`) — a tiny per-plan spender whose **token, merchant, amount per pull and period are immutable**. Because the permit names this contract as spender, the single signature binds all of those terms.

The flow:

1. **Subscribe** — the subscriber (once per wallet) approves USDC to Permit2, then signs one `PermitSingle` for `amount × pulls`, expiring after the last period. The server validates the payload with Zod, re-checks it against the contract's on-chain immutables, and the relayer calls `plan.subscribe(...)`, which has Permit2 verify the signature and starts the schedule.
2. **Collect** — the Vercel Schedule (hourly) calls `plan.pull(subscriber)` for each due period. The contract refuses early pulls, can only pay the merchant, and can never exceed the permit total. `pull` is permissionless: anyone can trigger a due pull, but nobody can redirect the money.
3. **Cancel** — the subscriber zeroes the Permit2 allowance from their own wallet (`Permit2.approve(token, plan, 0, 0)`). After that no pull can succeed, whatever the server or database says; the API refuses to record a cancellation until the allowance is actually gone.

### Fixed count or "until cancelled"

The plan contract has no pull counter. How many pulls can happen comes from the subscriber's signed permit, so it can differ per subscriber without redeploying:

- **Fixed (default)** — the permit's amount is `amount × pulls` and it expires after the last period (`NEXT_PUBLIC_PLAN_PULLS`, server cap 52).
- **Until cancelled** — the permit uses Permit2's unlimited sentinels: `amount = 2^160 − 1` (Permit2 never decrements it) and `expiration = 2^48 − 1` (never expires; note `0` would mean "expires now"). Pulls continue every period until the subscriber revokes. The collector appends one schedule row per period (`pulls_total` is `NULL` for these) and closes the subscription if the allowance is revoked or can never be pulled again.

Open-ended permits show up in wallets as an unlimited allowance, which looks alarming — the UI explains it up front. The safety comes from the contract (it can only ever pay the immutable merchant the fixed amount once per period) and from revocability, so treat the contract's correctness as load-bearing.

## Setup

```bash
cp .env.example .env.local
# Fill in your values
npm install
npm run dev
```

1. **Database.** Apply the schema with the [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase link <project-ref>`, then `supabase db push`) or run the files in `supabase/migrations/` in order in the SQL editor. The tables have Row Level Security enabled with no policies, so only the server-side secret key can read or write them.
2. **Deploy the plan contract** (Base Sepolia):

   ```bash
   npm run plan:simulate   # optional: no keys or funds needed
   npm run plan:deploy     # uses RELAYER_PRIVATE_KEY; prints NEXT_PUBLIC_PLAN_CONTRACT=0x…
   ```

   Put the printed `NEXT_PUBLIC_PLAN_CONTRACT=0x…` in `.env.local` and restart. A plan's terms are immutable: for a different merchant, amount or period, deploy another plan.
3. Fund the relayer address with a little Base Sepolia ETH (it only pays gas), and give the wallet you subscribe with some Base Sepolia ETH and testnet USDC.

`npm run plan:simulate` runs the compiled contract against the **real** Permit2 and USDC on Base Sepolia using `eth_simulateV1`, and checks: the signature encoding, on-schedule pulls, early-pull rejection, the permit-total cap, revoke, forged or mismatched inputs, and an unlimited permit that keeps pulling without being decremented.

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_DYNAMIC_ENV_ID` | Yes | Dynamic environment ID from [app.dynamic.xyz](https://app.dynamic.xyz) |
| `NEXT_PUBLIC_MERCHANT_ADDRESS` | Yes | Merchant EVM address that receives each pull (baked into the plan contract; used for display) |
| `NEXT_PUBLIC_PLAN_CONTRACT` | Yes | Address of the deployed `SubscriptionPlan` |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | Yes | Supabase project URL and secret API key — server only |
| `RELAYER_PRIVATE_KEY` | Yes | Server key that submits `subscribe`/`pull` and pays gas. **Testnet-only**; use a secrets manager (or MPC signing) in production |
| `CRON_SECRET` | Recommended | When set, `/api/cron/collect` requires `Authorization: Bearer <secret>` (Vercel sends it to schedules automatically) |
| `NEXT_PUBLIC_RPC_URL` / `RPC_URL` | No | Base Sepolia RPC override |
| `NEXT_PUBLIC_SOLANA_MERCHANT_ADDRESS` | For Solana | Merchant whose plans the app lists; must match `SOLANA_MERCHANT_PRIVATE_KEY` |
| `SOLANA_MERCHANT_PRIVATE_KEY` | For Solana | Merchant key that owns the plan and signs collection (base58 or JSON byte array). **Testnet-only**; server only |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | No | Solana devnet RPC (default: public devnet; must support `getProgramAccounts`) |
| `NEXT_PUBLIC_SOLANA_TOKEN_MINT` | No | SPL mint (default: Circle's devnet USDC) |
| `SOLANA_PLAN_AMOUNT` / `SOLANA_PLAN_PERIOD_HOURS` | No | Used only by `solana:create-plan` (default 100000 and 1) |
| `NEXT_PUBLIC_PLAN_AMOUNT` / `_PERIOD_SECONDS` / `_PULLS` | No | Must match the deployed contract: amount (default 100000 = 0.10 USDC), period (default 3600), and the fixed pull count (default 4) |

### Dynamic dashboard

1. Enable **EVM** and **Base Sepolia** under Chains & Networks
2. Enable **Embedded wallets** under Wallets (for the embedded-wallet path)
3. Enable **Email OTP** and/or **Google** under Sign-in Methods
4. Add your origins (`http://localhost:3000` and your deployed URL) under Security → Allowed Origins

## Solana (devnet)

Pick **Solana** in the chain switcher. The flow mirrors the [Solana subscriptions example](../nextjs-solana-subscriptions), but runs on devnet and adds server-side collection:

1. **Subscribe** — one transaction from the subscriber's Dynamic wallet: it creates their subscription authority PDA (first time per wallet + mint) and a subscription delegation that records the plan's exact terms (the program checks the terms they saw, so a plan can't change under them).
2. **Collect** — the merchant (or a listed `puller`) can pull up to the plan amount per period, only to the plan's destination. The hourly `collect-solana-pulls` schedule calls `/api/cron/collect-solana`, which reads subscriptions straight from chain (no database) and pulls what's due; the **Collect due pulls** button calls the wallet-scoped, secret-free `/api/solana/collect`.
3. **Cancel / resume** — cancelling sets an expiry at the end of the current period; the subscriber can resume until then.

We sign with the Dynamic wallet but submit through our own devnet RPC (`NEXT_PUBLIC_SOLANA_RPC_URL`), so the app doesn't depend on which Solana network the wallet is set to.

### Solana setup

1. Create a **merchant keypair** (testnet only) and fund it with devnet SOL from [faucet.solana.com](https://faucet.solana.com). Put the secret key in `.env.local` as `SOLANA_MERCHANT_PRIVATE_KEY` (base58 or a JSON byte array) and its public address as `NEXT_PUBLIC_SOLANA_MERCHANT_ADDRESS`.
2. Create the plan (default 0.10 USDC per hour; override with `SOLANA_PLAN_AMOUNT` / `SOLANA_PLAN_PERIOD_HOURS`):

   ```bash
   npm run solana:create-plan
   ```

3. Subscribers need devnet SOL for fees and devnet USDC from [faucet.circle.com](https://faucet.circle.com) (mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`).
4. In the Dynamic dashboard, enable **Solana** (and **Solana Devnet**) under Chains & Networks. Embedded wallets get a Solana wallet automatically on sign-in.

Node 24+ is required (`@solana-program/token` declares `node >=24`).

## Collecting pulls

`vercel.json` defines a Vercel [Schedule](https://vercel.com/docs/schedules) named `collect-pulls` that calls `/api/cron/collect` at the top of every hour (`0 * * * *`, UTC) to keep invocations cheap. Run it on demand with `vercel schedules invoke collect-pulls`, or pause it with `vercel schedules disable collect-pulls`. A due pull is collected at the next run, so it can land up to an hour late; the contract still enforces "no earlier than due".

- `/api/cron/collect` collects **every** due EVM pull and requires `CRON_SECRET`. `/api/cron/collect-solana` (schedule `collect-solana-pulls`, five minutes past each hour) does the same for Solana.
- The **Collect due pulls** button calls the secret-free `POST /api/collect?subscriber=0x…`, which only runs that wallet's already-due pulls (at most 5 per call).
- Locally nothing runs automatically. Use the button, or `curl -X POST -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/collect`.
- A run that dies mid-pull (serverless timeout) leaves its row in `posting`; rows claimed more than 10 minutes ago are put back in the queue on the next run.

## Deploying to Vercel

```bash
vercel link          # then add the env vars above to the Vercel project (production)
vercel deploy --prod
```

Add the deployed URL to the Dynamic allowed origins. Notes:

- Don't commit a `package-lock.json` that records a private registry mirror (check `resolved` URLs). If your build can't resolve them, exclude the lockfile from the upload with `.vercelignore` — but then versions of transitive dependencies are not reproducible.
- `vercel link` can connect the project to your GitHub repo; disconnect it if you don't want every push built.

## Known limitations

- **Unaudited demo contract.** One fixed plan per deployment; the permit has a fixed total and expiry (unless open-ended), so a fixed subscription needs a re-sign when it runs out.
- **`pull` is permissionless.** If someone triggers a due pull directly on-chain, the money still moves correctly (the contract is authoritative), but the database catches up one run later and a row can briefly look late or fail with `NotDue`.
- **No authentication on subscribe/collect.** Anyone can submit a valid signed permit (Permit2 verifies it) or trigger already-due pulls, which costs the relayer gas. Fine for a testnet demo; add rate limiting before putting real funds behind it.
- **Solana: one merchant, public RPC.** The app lists one merchant's plans and uses the public devnet RPC, which is rate-limited; set `NEXT_PUBLIC_SOLANA_RPC_URL` to a provider for anything real. `/api/solana/collect` is unauthenticated (like the EVM one): it can only trigger pulls that are already due, but each costs the merchant key a fee.
- **Hot relayer key.** The relayer key lives in an environment variable. It can only submit `subscribe`/`pull` (it can't redirect funds), but use a secrets manager or MPC signing in production.

## Resources

- [Solana Subscriptions example](../nextjs-solana-subscriptions) and the [program docs](https://solana.com/docs/payments/subscriptions/overview)
- [Permit2](https://github.com/Uniswap/permit2) and its [AllowanceTransfer docs](https://docs.uniswap.org/contracts/permit2/overview)
- [Dynamic JS SDK](https://docs.dynamic.xyz/javascript/reference/quickstart)
