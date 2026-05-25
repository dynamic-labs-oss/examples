# Solana Subscriptions with Dynamic

A Next.js demo that integrates [Dynamic's](https://dynamic.xyz) embedded Solana wallets with the [Solana Subscriptions program](https://solana.com/docs/payments/subscriptions/overview) — letting users subscribe to on-chain recurring payment plans and manage their subscriptions.

## What it does

- Sign in with email OTP, Google OAuth, or an injected Solana wallet via Dynamic
- Browse subscription plans created by a configured merchant
- Subscribe to a plan (initializes a subscription authority and creates a subscription delegation on-chain)
- View and cancel active subscriptions

## How it works

The Solana Subscriptions program lets merchants create on-chain plans with a fixed amount and period. Users subscribe by delegating token transfer rights to a subscription authority PDA. Merchants then call `transferSubscription` to collect recurring payments without needing the user to sign each time.

### Transaction flow

1. **initSubscriptionAuthority** (once per user + token mint): Creates a PDA that controls which subscriptions can pull from the user's token account.
2. **subscribe**: Creates a `SubscriptionDelegation` PDA recording the plan terms. The merchant can pull up to `amount` per `periodHours` until the subscription is cancelled.
3. **cancelSubscription**: Sets an `expiresAtTs` on the delegation — future pulls are blocked once that timestamp is reached.

Dynamic's embedded wallet handles all signing. The app uses `@solana/kit` v6 to build the subscription instructions and bridges them to `@solana/web3.js` v1 `VersionedTransaction` for Dynamic to sign.

## Setup

```bash
cp .env.example .env.local
# Fill in your values
pnpm install
pnpm dev
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_DYNAMIC_ENV_ID` | Yes | Dynamic environment ID from [app.dynamic.xyz](https://app.dynamic.xyz) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Yes | Solana RPC URL (devnet or mainnet) |
| `NEXT_PUBLIC_MERCHANT_ADDRESS` | Yes | Merchant wallet address whose plans to display |
| `NEXT_PUBLIC_TOKEN_MINT` | No | Token mint address (defaults to devnet USDC) |
| `NEXT_PUBLIC_TOKEN_PROGRAM` | No | Token program address (defaults to SPL Token) |

### Dynamic dashboard

1. Enable **Solana** under Chains & Networks
2. Enable **Embedded wallets** under Wallets
3. Enable **Email OTP** and/or **Google** under Sign-in Methods
4. Add `http://localhost:3000` under Security → Allowed Origins

## Resources

- [Solana Subscriptions documentation](https://solana.com/docs/payments/subscriptions/overview)
- [Dynamic JS SDK](https://docs.dynamic.xyz/javascript/reference/quickstart)
- [`@solana/subscriptions` npm package](https://www.npmjs.com/package/@solana/subscriptions)
- [Demo webapp](https://solana-subscriptions-program.vercel.app/)
