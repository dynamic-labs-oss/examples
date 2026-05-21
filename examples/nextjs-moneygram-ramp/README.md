# MoneyGram Cash Off-Ramp

Demonstrates MoneyGram cash off-ramp using Dynamic embedded wallets across Base, Ethereum, and Solana.

## Overview

This example shows how to integrate MoneyGram's Ramps API with Dynamic embedded wallets for cash off-ramp functionality. Users can connect their wallet (EVM or Solana) via Dynamic, then initiate USDC withdrawals to cash through the MoneyGram network. The demo supports devnet/sandbox environments.

## Setup

### Prerequisites
- Node.js 18+
- A [Dynamic](https://app.dynamic.xyz) account with EVM + Solana embedded wallets enabled
- A MoneyGram Ramps API key (sandbox prefix: `ramps_pk_sbox_`)

### Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` | Your Dynamic environment ID (found in Dashboard → Developer Settings) |
| `NEXT_PUBLIC_MG_RAMP_KEY` | Your MoneyGram Ramps API key |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana RPC endpoint (e.g. Helius, QuickNode, or public devnet) |
| `NEXT_PUBLIC_SOLANA_USDC_MINT` | USDC SPL token mint address for your environment |

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How it works

The app uses Dynamic's JS SDK for multi-chain wallet authentication (EVM and Solana). After connecting, users can initiate USDC off-ramp transactions which are processed through MoneyGram's cash disbursement network.

## Learn more

- [Dynamic documentation](https://docs.dynamic.xyz)
- [MoneyGram Ramps documentation](https://docs.moneygram.com)
- [GitHub repository](https://github.com/dynamic-labs-oss/examples)
