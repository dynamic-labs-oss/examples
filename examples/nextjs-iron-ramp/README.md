# Euro Fiat On/Off-Ramp (Iron Finance)

Demonstrates Euro fiat on/off-ramp using Iron Finance and Dynamic embedded wallets.

## Overview

This example shows how to integrate Iron Finance's fiat on/off-ramp into a Next.js app with Dynamic embedded wallets. Users can connect their wallet via Dynamic, then deposit or withdraw EUR using Iron Finance's ramp API. The app supports both sandbox and production environments.

## Setup

### Prerequisites
- Node.js 18+
- A [Dynamic](https://app.dynamic.xyz) account with an environment set up
- An [Iron Finance](https://docs.iron.xyz) account with API credentials

### Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_DYNAMIC_ENV_ID` | Your Dynamic environment ID (found in Dashboard → Developer Settings) |
| `IRON_API_KEY` | Your Iron Finance API key |
| `IRON_ENVIRONMENT` | Set to `sandbox` for testing or `production` for live |
| `NEXT_PUBLIC_IRON_ENVIRONMENT` | Client-side environment indicator (`sandbox` or `production`) |

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How it works

The app uses Dynamic's JS SDK for wallet authentication and Iron Finance's API for fiat ramp operations. After connecting their wallet, users can initiate EUR deposits or withdrawals which are processed through Iron Finance's payment rails.

## Learn more

- [Dynamic documentation](https://docs.dynamic.xyz)
- [Iron Finance documentation](https://docs.iron.xyz)
- [GitHub repository](https://github.com/dynamic-labs-oss/examples)
