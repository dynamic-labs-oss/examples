# Kamino Earn with Dynamic

A Next.js application demonstrating how to integrate [Kamino Finance](https://kamino.finance) Earn vaults on Solana using [Dynamic](https://dynamic.xyz) embedded wallets.

## What this example shows

- Sign in with a Dynamic embedded Solana wallet (no UI widget — headless SDK)
- Browse all Kamino Earn vaults with live APY and TVL data
- Deposit tokens into any vault and view your positions
- Withdraw shares from vaults

## How it works

### Wallet integration

This example uses the headless Dynamic client SDK (`@dynamic-labs-sdk/client`) and its Solana extension (`@dynamic-labs-sdk/solana`). There is no `DynamicContextProvider` or React widget involved:

```typescript
// src/lib/dynamic.ts
import { createDynamicClient } from "@dynamic-labs-sdk/client";
import { addSolanaExtension } from "@dynamic-labs-sdk/solana";

export const dynamicClient = createDynamicClient({ environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID! });
addSolanaExtension();
```

### Vault data

Vault listings, APY, and TVL are fetched from [Kamino's public API](https://api.kamino.finance):

- `GET /kvaults/vaults` — all available vaults
- `GET /kvaults/vaults/{pubkey}/metrics` — APY and TVL per vault
- `GET /kvaults/users/{pubkey}/positions` — user's active positions

### Transactions (deposit / withdraw)

Each Kamino operation returns multiple instruction groups that must be sent as **separate transactions** (combining them exceeds the 1232-byte Solana limit). All transactions are built in parallel and signed in a single MPC round with `signAllTransactions`, then sent and confirmed sequentially:

```typescript
import { signAllTransactions } from "@dynamic-labs-sdk/solana";
import { KaminoVault } from "@kamino-finance/klend-sdk";

const vault = new KaminoVault(rpc, address(vaultAddress));
const depositIxs = await vault.depositIxs(noopSigner, new Decimal(amount));

const groups = [depositIxs.depositIxs, depositIxs.stakeInFarmIfNeededIxs, ...].filter(g => g.length > 0);

// Build all transactions in parallel, sign in one MPC round
const prepared = await Promise.all(groups.map(g => prepareTransaction(g, noopSigner)));
const { signedTransactions } = await signAllTransactions(
  { transactions: prepared.map(p => p.unsigned), walletAccount: solanaAccount },
  dynamicClient
);

// Send and confirm sequentially
for (let i = 0; i < signedTransactions.length; i++) {
  await sendAndConfirm(signedTransactions[i], prepared[i].blockhash, prepared[i].lastValidBlockHeight);
}
```

## Getting started

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn/bun)

### Installation

```bash
pnpm install
```

### Environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and set your Dynamic environment ID:

```env
NEXT_PUBLIC_DYNAMIC_ENV_ID=your-environment-id
```

Get your environment ID from the [Dynamic dashboard](https://app.dynamic.xyz) under **Developer Settings → SDK & API Keys**.

The Solana RPC URL is sourced automatically from your Dynamic dashboard network configuration — no separate `SOLANA_RPC_URL` env var is needed.

### Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
├── app/
│   ├── layout.tsx              # App layout with providers
│   └── page.tsx                # SSR-safe dynamic import of VaultsInterface
├── components/
│   ├── VaultsInterface.tsx     # Vault list, positions, action handlers
│   ├── VaultCard.tsx           # Per-vault deposit/withdraw UI
│   └── PositionCard.tsx        # User position display
└── lib/
    ├── dynamic.ts              # Dynamic client + Solana extension setup
    ├── kamino.ts               # Kamino REST API helpers
    ├── providers.tsx           # Wallet context + TanStack Query provider
    ├── types.ts                # TypeScript types
    ├── useVaultOperations.ts   # Deposit/withdraw hook
    └── utils.ts                # Token info, formatters
```

## Key packages

| Package | Purpose |
|---|---|
| `@dynamic-labs-sdk/client` | Headless Dynamic SDK — auth, wallet accounts, events |
| `@dynamic-labs-sdk/solana` | Solana extension — `signAllTransactions`, account types |
| `@kamino-finance/klend-sdk` | Builds deposit/withdraw instruction groups |
| `@solana/kit` | Transaction construction (used by Kamino SDK and this app) |
| `@solana/web3.js` | `VersionedTransaction` bridge + `Connection` for send/confirm |
| `decimal.js` | Token amount handling (required by Kamino SDK) |
| `@tanstack/react-query` | Data fetching and caching |

## Resources

- [Dynamic Docs](https://docs.dynamic.xyz)
- [Kamino Finance](https://kamino.finance)
- [Kamino SDK (klend-sdk)](https://www.npmjs.com/package/@kamino-finance/klend-sdk)
