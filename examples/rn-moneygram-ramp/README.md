# rn-moneygram-ramp

React Native (Expo) demo app for off-ramping USDC to cash via MoneyGram Ramps, powered by Dynamic embedded wallets.

**Solana / USDC** only.

## What it does

1. User signs in with email OTP (or Google) — Dynamic creates a Solana embedded wallet automatically
2. The **Home** tab shows the Solana wallet address and USDC balance (with a mainnet/devnet toggle)
3. Tapping **Cash Pickup** opens the MoneyGram Ramps widget in a full-screen WebView
4. The app handles the postMessage protocol: balance checks, transaction signing, and lifecycle events
5. Completed transactions are persisted locally and listed under the **Transactions** tab
6. Tapping a transaction reopens it in **view mode** to check its status or request a refund
7. The **Profile** tab shows the account email + wallet address and handles sign out
8. User picks up cash at any MoneyGram location worldwide

## Prerequisites

- Node 18+
- Expo CLI: `npm i -g expo@latest`
- A [Dynamic Labs](https://app.dynamic.xyz) account with:
  - Email OTP (and optionally Google OAuth) enabled
  - Embedded wallets turned on for **Solana**
  - **Solana** chain enabled
  - App origin `http://localhost:8081` allowlisted
- A MoneyGram Ramps API key (sandbox: `ramps_pk_sbox_...`) — used server-side only
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

The off-ramp also needs the session server running (it holds the MoneyGram
secret key). See [`server/`](./server) — start it and point
`EXPO_PUBLIC_SESSION_URL` at it.

## Environment variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_DYNAMIC_ENVIRONMENT_ID` | Dynamic Labs environment ID |
| `EXPO_PUBLIC_SESSION_URL` | URL of your MoneyGram session server (`server/`) |
| `EXPO_PUBLIC_SOLANA_USDC_MINT` | USDC mint address on Solana |
| `EXPO_PUBLIC_RAMPS_API_URL` | _Optional_ — MoneyGram API base (defaults to the widget origin) |

## Tech stack

| Package | Purpose |
|---|---|
| `@dynamic-labs/client` | Core Dynamic JS SDK |
| `@dynamic-labs/react-native-extension` | WebView auth + secure storage |
| `@dynamic-labs/react-hooks` | `useReactiveClient` for reactive state |
| `@dynamic-labs/solana-extension` | Solana wallet + signing |
| `react-native-webview` | MoneyGram widget WebView |
| `@solana/web3.js` + `@solana/spl-token` | Solana USDC balance + transfers |
| `@react-native-async-storage/async-storage` | Local transaction history |
| `@expo/vector-icons` | Bottom tab icons |

## MoneyGram postMessage protocol

The widget communicates via `window.postMessage`. The app handles:

| Message | Direction | Description |
|---|---|---|
| `RAMPS_READY` | Widget → App | Widget loaded; app responds with config |
| `RAMPS_CONFIG` | App → Widget | Session token, wallet address, chain, theme |
| `RAMPS_CHECK_BALANCE` | Widget → App | Fetch on-chain USDC balance |
| `RAMPS_BALANCE_RESULT` | App → Widget | Balance + sufficient flag |
| `RAMPS_SIGN_TRANSACTION` | Widget → App | Sign + broadcast USDC transfer |
| `RAMPS_SIGN_SUCCESS` | App → Widget | Transaction hash |
| `RAMPS_SIGN_ERROR` | App → Widget | Error message |
| `RAMPS_TRANSACTION_COMPLETE` | Widget → App | Off-ramp complete; app persists the record |
| `RAMPS_OPEN_URL` | Widget → App | Open external URL (KYC, etc.) |
| `RAMPS_CLOSE` | Widget → App | User dismissed widget |

Signing is fully implemented in `components/MoneygramWidget.tsx`
(`sendUsdcViaDynamic`): it builds a versioned USDC transfer (creating the
recipient ATA if needed), signs it with the Dynamic Solana signer, and confirms
it on-chain before replying with `RAMPS_SIGN_SUCCESS`.

## Transaction history, status & refunds

When an off-ramp completes, `RAMPS_TRANSACTION_COMPLETE` carries a
`referenceNumber` — the code the recipient presents at a MoneyGram agent
location to collect cash. The widget persists each transaction to `AsyncStorage`
(`lib/moneygram.ts`), keyed by transaction `id`, so it survives app restarts.

- The **Transactions** tab (`app/(app)/history.tsx`) lists stored transactions
  (amount, reference number, date), newest first. Records are keyed by `id`, so
  completing the same transaction again updates it in place.
- Tapping a row reopens the widget in **view mode** by passing
  `viewTransactionId`. In view mode the widget is read-only — it fetches the
  **live status**, shows pickup instructions, and **handles refund requests
  entirely within the widget**. Refunded USDC is returned to the original Solana
  wallet address.

> **Why the list doesn't show a live status:** the widget owns transaction
> status and **never posts status changes back to the app** — refunds and status
> updates happen entirely inside the widget, and the MoneyGram REST API can't be
> called directly from the client (CORS). So the app can't know a transaction was
> refunded; the live status is only shown when you open it in view mode. To
> surface live status in the list you'd add a server-side status fetch (the
> session server already holds the secret key).

> **Sandbox note:** reference numbers are issued but not redeemable, and the
> Solana deposit wallet may return a placeholder address until your **agent ID
> for Solana** is provisioned (see the `__DEV__` stub in `MoneygramWidget.tsx`).
> Contact your MoneyGram partner manager if you hit `IP-50000`.
