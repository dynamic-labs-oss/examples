# Mayan Cross-Chain Swap with Dynamic JS SDK

A cross-chain swap demo using **Dynamic's JavaScript SDK** (no React SDK dependency) and the **Mayan Finance** protocol. Supports swapping from any EVM chain to EVM or non-EVM destinations (Solana, Sui, HyperCore).

## Features

- **Dynamic JS SDK**: Headless auth with email OTP, Google OAuth, and injected EVM wallets via `@dynamic-labs/client`
- **Embedded EVM Wallets**: WaaS wallets created automatically on sign-up via `@dynamic-labs/evm`
- **Mayan Routing**: Cross-chain quotes and swap execution using `@mayanfinance/swap-sdk`
- **EVM → Any Chain**: Source chain must be EVM; destination supports Solana, Sui, HyperCore, and all EVM chains
- **ERC-20 Approvals**: Automatic allowance check and approval before swap execution
- **Chain Switching**: `wallet_switchEthereumChain` called automatically when the selected FROM chain differs from the wallet's active network

## Tech Stack

| Layer             | Library                                      |
| ----------------- | -------------------------------------------- |
| Auth & Wallets    | `@dynamic-labs/client` + `@dynamic-labs/evm` |
| Chain interaction | `viem`                                       |
| Cross-chain swaps | `@mayanfinance/swap-sdk`                     |
| UI                | Next.js 15, Tailwind CSS                     |

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

```env
NEXT_PUBLIC_DYNAMIC_ENV_ID=your_dynamic_environment_id
```

Get a Dynamic environment ID at [app.dynamic.xyz](https://app.dynamic.xyz).

### 3. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

1. **Sign in** — email OTP, Google, or connect MetaMask via the custom Dynamic button
2. **Select FROM chain** — EVM chains only (Ethereum, Polygon, BSC, Avalanche, Arbitrum, Optimism, Base)
3. **Select TO chain** — any chain supported by Mayan (including Solana, Sui, HyperCore)
4. **Pick tokens & amount** — tokens fetched from Mayan's token API
5. **Get quote** — Mayan returns best available route with estimated output and fees
6. **Execute swap** — ERC-20 approval (if needed) then swap transaction sent via viem wallet client

## Supported Networks

| Direction        | Chains                                                      |
| ---------------- | ----------------------------------------------------------- |
| FROM (source)    | Ethereum, Polygon, BSC, Avalanche, Arbitrum, Optimism, Base |
| TO (destination) | All of the above + Solana, Sui, HyperCore                   |

## Learn More

- [Dynamic JS SDK Documentation](https://docs.dynamic.xyz/javascript)
- [Mayan Finance Documentation](https://docs.mayan.finance)
- [Mayan SDK on npm](https://www.npmjs.com/package/@mayanfinance/swap-sdk)
