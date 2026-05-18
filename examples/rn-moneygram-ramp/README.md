# rn-moneygram-ramp

React Native (Expo) demo app for off-ramping USDC to cash via MoneyGram Ramps, powered by Dynamic embedded wallets.

Supports **Base**, **Ethereum**, and **Solana** in a single app.

## What it does

1. User signs in with email OTP — Dynamic creates embedded EVM and Solana wallets automatically
2. User picks a chain (Base / Ethereum / Solana) and sees their USDC balance
3. Tapping **Cash Pickup** opens the MoneyGram Ramps widget in a full-screen WebView
4. The app handles the postMessage protocol: balance checks, transaction signing, and success callbacks
5. User picks up cash at any MoneyGram location worldwide

## Prerequisites

- Node 18+
- Expo CLI: `npm i -g expo@latest`
- A [Dynamic Labs](https://app.dynamic.xyz) account with:
  - Email OTP enabled
  - Embedded wallets turned on (EVM + Solana)
  - Base, Ethereum, Solana chains enabled
  - App origin `http://localhost:8081` allowlisted
- A MoneyGram Ramps API key (sandbox: `ramps_pk_sbox_...`)
- **Expo Go does NOT work** — you need a development build (`expo prebuild`)

## Setup

```bash
# 1. Install dependencies
cd examples/rn-moneygram-ramp
npm install   # or pnpm install

# 2. Copy and fill in env vars
cp .example.env .env
# Edit .env with your keys

# 3. Prebuild (required for native modules)
npx expo prebuild

# 4. Run on iOS simulator
npx expo run:ios

# 5. Run on Android emulator
npx expo run:android
```

## Environment variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_DYNAMIC_ENVIRONMENT_ID` | Dynamic Labs environment ID |
| `EXPO_PUBLIC_MG_RAMP_KEY` | MoneyGram Ramps API key |
| `EXPO_PUBLIC_SOLANA_RPC_URL` | Solana RPC URL (default: devnet) |
| `EXPO_PUBLIC_SOLANA_USDC_MINT` | USDC mint address on Solana |

## Tech stack

| Package | Purpose |
|---|---|
| `@dynamic-labs/client` | Core Dynamic JS SDK |
| `@dynamic-labs/react-native-extension` | WebView auth + secure storage |
| `@dynamic-labs/react-hooks` | `useReactiveClient` for reactive state |
| `@dynamic-labs/viem-extension` | EVM transaction signing via viem |
| `@dynamic-labs/solana-extension` | Solana wallet support |
| `react-native-webview` | MoneyGram widget iframe |
| `viem` | EVM balance + calldata encoding |
| `@solana/web3.js` + `@solana/spl-token` | Solana USDC balance |

## MoneyGram postMessage protocol

The widget communicates via `window.postMessage`. The app handles:

| Message | Direction | Description |
|---|---|---|
| `RAMPS_READY` | Widget → App | Widget loaded; app responds with config |
| `RAMPS_CONFIG` | App → Widget | API key, wallet address, chain, theme |
| `RAMPS_CHECK_BALANCE` | Widget → App | Fetch on-chain USDC balance |
| `RAMPS_BALANCE_RESULT` | App → Widget | Balance + sufficient flag |
| `RAMPS_SIGN_TRANSACTION` | Widget → App | Sign + broadcast USDC transfer |
| `RAMPS_SIGN_SUCCESS` | App → Widget | Transaction hash |
| `RAMPS_SIGN_ERROR` | App → Widget | Error message |
| `RAMPS_TRANSACTION_COMPLETE` | Widget → App | Off-ramp complete |
| `RAMPS_OPEN_URL` | Widget → App | Open external URL (KYC, etc.) |
| `RAMPS_CLOSE` | Widget → App | User dismissed widget |

## Completing the EVM signing integration

`components/MoneygramWidget.tsx` has a placeholder for EVM transaction signing. To fully wire it up:

```typescript
import { dynamicClient } from "@/lib/dynamic";

// Inside handleEvmTransaction:
const walletClient = await dynamicClient.viem.createWalletClient({ wallet: evmWallet });
const hash = await walletClient.sendTransaction({
  to: usdcAddress as `0x${string}`,
  data: calldata,
});
post("RAMPS_SIGN_SUCCESS", { txHash: hash });
```

## Completing the Solana signing integration

For Solana, use `@dynamic-labs/solana-extension` to sign and send the transaction:

```typescript
import { SolanaExtension } from "@dynamic-labs/solana-extension";
// Sign the transaction payload provided by the widget
// and broadcast via @solana/web3.js Connection.sendRawTransaction
```
