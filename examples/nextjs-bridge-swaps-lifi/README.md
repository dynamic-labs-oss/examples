# LiFi Cross-Chain Swaps with Dynamic

A cross-chain token bridging and swapping demo powered by **Dynamic** authentication and **LiFi** routing. Sign in with email, Google, or an injected wallet, then bridge or swap tokens across EVM chains in a few clicks.

## Features

- **Dynamic Auth**: Email OTP, Google OAuth, and injected wallet (MetaMask, etc.) login via `@dynamic-labs/sdk-react-core`
- **Embedded Wallets**: WaaS embedded EVM wallets created automatically on sign-up
- **LiFi Routing**: Multi-hop route finding across Ethereum, Polygon, Arbitrum, Optimism, Base, and Avalanche
- **Execution Tracking**: Step-by-step progress display with transaction hashes and explorer links
- **Resume / Background**: Pause, resume, or background long-running cross-chain executions
- **Chain Switching**: Automatic wallet chain switching via wagmi when LiFi routes across multiple chains

## Tech Stack

| Layer | Library |
|---|---|
| Auth & Wallets | `@dynamic-labs/sdk-react-core` + `@dynamic-labs/wagmi-connector` |
| Chain interaction | `wagmi` + `viem` |
| Cross-chain routing | `@lifi/sdk` |
| Wallet sync | `@lifi/wallet-management` |
| UI | Next.js 15, Tailwind CSS, shadcn/ui |

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
NEXT_PUBLIC_LIFI_API_KEY=your_lifi_api_key   # optional, avoids rate limits
```

Get a Dynamic environment ID at [app.dynamic.xyz](https://app.dynamic.xyz).  
Get a LiFi API key at [docs.li.fi](https://docs.li.fi).

### 3. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

1. **Sign in** — email OTP, Google, or connect MetaMask via the Dynamic widget
2. **Select chains & tokens** — choose FROM/TO chain and token from the LiFi token lists
3. **Get routes** — LiFi finds optimal bridge/swap paths and shows cost + estimated time
4. **Execute swap** — approve the route; LiFi handles chain switching and transaction signing automatically via wagmi
5. **Track progress** — watch each step complete in real time; resume or stop if needed

## Supported Chains

Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche (all EVM).

## Learn More

- [Dynamic Documentation](https://docs.dynamic.xyz)
- [LiFi SDK Documentation](https://docs.li.fi)
- [Dynamic + LiFi Integration Guide](https://www.dynamic.xyz/docs/recipes/integrations/swaps/lifi)
