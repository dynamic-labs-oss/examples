# Dynamic JS SDK Wallet Demo

A Next.js example demonstrating embedded wallet (WaaS) functionality using the [Dynamic JavaScript SDK](https://www.dynamic.xyz/docs/javascript).

## Features

- **Email OTP Authentication** - Passwordless login via email one-time password
- **Social OAuth** - Login with any dashboard-enabled social provider (Google, Discord, etc.)
- **External JWT Auth** - Sign in with a third-party JWT token ([setup guide](docs/external-jwt-auth.md))
- **Embedded Wallets (WaaS)** - Create EVM and Solana wallets tied to user accounts
- **Multi-Network Support** - Switch between enabled networks (Ethereum, Base, Sepolia, etc.)
- **Gas Sponsorship** - ZeroDev integration for sponsored transactions on supported networks
- **EIP-7702 Smart Accounts** - One-time authorization for gasless transactions on EVM chains
- **MFA/TOTP Support** - Multi-factor authentication with authenticator apps (Google Authenticator, Authy, etc.)
- **Send Transactions** - Transfer native tokens with automatic wallet selection
- **Transaction History** - View paginated transaction history for SVM wallets

## Architecture

```
├── app/
│   ├── page.tsx              # Server component entry point
│   ├── globals.css           # Theme variables and global styles
│   ├── jwt/
│   │   └── page.tsx          # JWT generator (dev utility)
│   └── api/
│       ├── dev/              # Dev-only API routes
│       │   ├── jwt/route.ts  # JWT signing endpoint
│       │   ├── jwks/route.ts # JWKS public key endpoint
│       │   └── ngrok/route.ts# Ngrok tunnel detection
│       └── webhooks/
│           └── dynamic/
│               └── route.ts  # Webhook endpoint for Dynamic events
├── components/
│   ├── wallet-app.tsx        # Main client component (SDK-dependent logic)
│   ├── auth/                 # Auth method sections
│   │   ├── email-otp-section.tsx
│   │   ├── social-providers-section.tsx
│   │   └── jwt-auth-section.tsx
│   ├── screens/              # Full-page screen components
│   │   ├── auth-screen.tsx
│   │   ├── otp-verify-screen.tsx
│   │   ├── dashboard-screen.tsx
│   │   ├── send-tx-screen.tsx
│   │   ├── tx-history-screen.tsx       # Transaction history
│   │   ├── setup-mfa-screen.tsx        # TOTP authenticator setup
│   │   └── authorize-7702-screen.tsx   # EIP-7702 smart account authorization
│   ├── wallet/               # Wallet-specific components
│   │   ├── wallet-row.tsx
│   │   ├── scrollable-wallet-list.tsx
│   │   ├── create-wallet-buttons.tsx
│   │   ├── network-selector.tsx
│   │   └── network-selector-section.tsx
│   └── ui/                   # Reusable UI primitives
│       ├── mfa-code-input.tsx
│       ├── copy-button.tsx
│       ├── tooltip.tsx
│       └── ...
├── hooks/
│   ├── use-auth.ts           # Auth state subscription
│   ├── use-gas-sponsorship.ts # Sponsorship check & wallet selection
│   ├── use-mfa-status.ts     # MFA enabled/device status
│   ├── use-7702-authorization.ts # On-chain authorization check
│   ├── use-navigation.ts     # Screen routing state machine
│   ├── use-mutations.ts      # React Query mutations
│   └── use-*.ts              # Other data hooks
├── lib/
│   ├── dynamic/              # SDK wrapper functions (one file per feature)
│   │   ├── client.ts         # Singleton client & SSR-safe wrapper factories
│   │   ├── auth.ts           # Sign in / sign out
│   │   ├── auth-email.ts     # Email OTP authentication
│   │   ├── auth-social.ts    # OAuth social providers
│   │   ├── auth-jwt.ts       # External JWT authentication
│   │   ├── wallets.ts        # Wallet accounts & type guards
│   │   ├── networks.ts       # Network queries & switching
│   │   ├── balance.ts        # Wallet balance
│   │   ├── transaction-history.ts # Transaction history
│   │   ├── mfa.ts            # Multi-factor authentication
│   │   ├── evm.ts            # EVM transactions (viem)
│   │   ├── solana.ts         # Solana transactions
│   │   ├── zerodev.ts        # Account abstraction & EIP-7702
│   │   ├── gas-sponsorship.ts # Gas sponsorship configuration
│   │   ├── events.ts         # SDK event subscriptions
│   │   ├── init.ts           # Client initialization
│   │   └── index.ts          # Barrel re-export
│   ├── transactions/         # Chain-specific transaction logic
│   │   ├── send-transaction.ts
│   │   ├── send-evm-transaction.ts
│   │   ├── send-solana-transaction.ts
│   │   └── sign-7702-authorization.ts
│   ├── viem-chain.ts         # NetworkData to viem chain conversion
│   └── wallet-utils.ts       # Helper functions
├── scripts/
│   └── generate-keypair.ts   # RSA key pair generation for JWT auth
└── docs/
    └── external-jwt-auth.md  # External JWT auth setup guide
```

### SDK Reference Files

Each file in `lib/dynamic/` is a self-contained reference for one SDK feature. You can point to any file directly:

| Feature             | File                                                           | SDK Functions                                                    |
| ------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Authentication      | [`auth.ts`](lib/dynamic/auth.ts)                               | `isSignedIn`, `logout`                                           |
| Email OTP           | [`auth-email.ts`](lib/dynamic/auth-email.ts)                   | `sendEmailOTP`, `verifyOTP`                                      |
| Social OAuth        | [`auth-social.ts`](lib/dynamic/auth-social.ts)                 | `authenticateWithSocial`, `detectOAuthRedirect`                  |
| External JWT Auth   | [`auth-jwt.ts`](lib/dynamic/auth-jwt.ts)                       | `signInWithExternalJwt`, `isExternalAuthEnabled`                 |
| Wallets             | [`wallets.ts`](lib/dynamic/wallets.ts)                         | `getWalletAccounts`, `createWaasWalletAccounts`                  |
| Networks            | [`networks.ts`](lib/dynamic/networks.ts)                       | `getNetworksData`, `switchActiveNetwork`                         |
| Balance             | [`balance.ts`](lib/dynamic/balance.ts)                         | `getBalance`                                                     |
| Transaction History | [`transaction-history.ts`](lib/dynamic/transaction-history.ts) | `getTransactionHistory`                                          |
| MFA                 | [`mfa.ts`](lib/dynamic/mfa.ts)                                 | `authenticateTotpMfaDevice`, `getMfaDevices`                     |
| EVM                 | [`evm.ts`](lib/dynamic/evm.ts)                                 | `createWalletClientForWalletAccount`                             |
| Solana              | [`solana.ts`](lib/dynamic/solana.ts)                           | `signAndSendTransaction`                                         |
| ZeroDev             | [`zerodev.ts`](lib/dynamic/zerodev.ts)                         | `createKernelClientForWalletAccount`, `signEip7702Authorization` |
| Gas Sponsorship     | [`gas-sponsorship.ts`](lib/dynamic/gas-sponsorship.ts)         | `isNetworkSponsored`, `isSvmGasSponsorshipEnabled`               |

## Key Concepts

### 1. SSR-Safe SDK Initialization

The Dynamic client is initialized as a singleton with SSR guards:

```typescript
// lib/dynamic/client.ts
function getClient(): DynamicClient | null {
  if (typeof window === "undefined") return null; // SSR guard

  if (!_client) {
    _client = createDynamicClient({
      environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID!,
    });
    addEvmExtension(_client);
    addSolanaExtension(_client);
    addZerodevExtension(_client);
  }
  return _client;
}
```

### 2. Reactive Auth State

Uses `useSyncExternalStore` to subscribe to Dynamic SDK events:

```typescript
// hooks/use-auth.ts
export function useAuth(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

### 3. Gas Sponsorship & Wallet Selection

The `useGasSponsorship` hook handles both sponsorship checking and wallet selection:

```typescript
// hooks/use-gas-sponsorship.ts
export function useGasSponsorship(
  walletAddress,
  allWalletAccounts,
  networkData,
) {
  // 1. Find ZeroDev and base wallets for this address
  // 2. Switch ZeroDev wallet to target network
  // 3. Check isNetworkSponsored(networkId) or canSponsorUserOperation for availability
  // 4. Return walletToUse (ZeroDev if sponsored, base otherwise)

  return { isSponsored, isLoading, walletToUse, zerodevWallet, baseWallet };
}
```

### 4. Transaction Flow

Transactions use the wallet selected by `useGasSponsorship`:

```typescript
// lib/transactions/send-evm-transaction.ts
export async function sendEvmTransaction({ walletAccount, ... }) {
  // ZeroDev wallet → use kernel client (supports sponsorship)
  if (walletAccount.walletProviderKey.includes("zerodev")) {
    const kernelClient = await createKernelClientForWalletAccount({
      smartWalletAccount: walletAccount,
    });
    return await kernelClient.sendTransaction(tx);
  }

  // Base wallet → use viem wallet client
  const walletClient = await createWalletClientForWalletAccount({ walletAccount });
  return await walletClient.sendTransaction(tx);
}
```

### 5. Transaction History

Fetch paginated transaction history for a wallet address:

```typescript
// lib/dynamic/transaction-history.ts
const { transactions, nextOffset } = await getTransactionHistory({
  address: walletAddress,
  chain: "SOL",
  networkId: 101,
  limit: 10,
});
```

See [`tx-history-screen.tsx`](components/screens/tx-history-screen.tsx) for the full React implementation with network switching, pagination, and relative time formatting.

### 6. Network Switching

The `NetworkSelector` switches all wallets for an address to keep them in sync:

```typescript
// components/wallet/network-selector.tsx
await Promise.all(
  walletsForAddress.map((wallet) =>
    switchActiveNetwork({ networkId, walletAccount: wallet }),
  ),
);
```

### 7. MFA (Multi-Factor Authentication)

The app supports TOTP-based MFA using authenticator apps. The `useMfaStatus` hook checks if MFA is enabled and whether a device is registered:

```typescript
// hooks/use-mfa-status.ts
export function useMfaStatus() {
  // Check MFA settings and registered devices
  return {
    isMfaEnabled, // MFA enabled in environment
    hasDevice, // User has registered authenticator
    needsSetup, // MFA enabled but no device (show setup prompt)
    requiresMfa, // MFA required for transactions (enabled + device exists)
  };
}
```

When MFA is required, users must enter a 6-digit TOTP code from their authenticator app to sign transactions.

### 8. EIP-7702 Smart Account Authorization

For gasless transactions on EVM chains, the wallet must be authorized as a smart account via EIP-7702. This is a one-time on-chain authorization per network:

```typescript
// hooks/use-7702-authorization.ts
export function use7702Authorization(address, networkData) {
  // Check if address has 7702 delegation prefix (0xef0100)
  const code = await client.getCode({ address });
  const isAuthorized = code?.startsWith("0xef0100") ?? false;

  return { isAuthorized, invalidate };
}
```

The authorization flow:

1. User signs EIP-7702 authorization (with MFA code if required)
2. Signed authorization is attached to the first transaction
3. Transaction is sent, which also broadcasts the authorization on-chain
4. Future transactions on that network don't need re-authorization

## Setup

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env.local
   ```

   Set your Dynamic environment ID:

   ```
   NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=your-environment-id
   ```

3. **Run development server:**
   ```bash
   pnpm dev
   ```

## Dynamic Dashboard Configuration

In your [Dynamic Dashboard](https://app.dynamic.xyz):

1. **Enable Email Authentication** - Settings → Authentication → Email
2. **Enable Social Providers** - Settings → Authentication → Social → Enable desired providers
3. **Enable External JWT Auth (optional)** - See [setup guide](docs/external-jwt-auth.md)
4. **Enable Embedded Wallets** - Settings → Embedded Wallets → Enable for EVM and/or Solana
5. **Allow Multiple Wallets** - Settings → Embedded Wallets → Enable "Allow multiple embedded wallets per chain"
6. **Configure Networks** - Settings → Chains & Networks → Enable desired networks
7. **Configure ZeroDev (optional)** - Settings → Embedded Wallets → ZeroDev for gas sponsorship
8. **Configure MFA (optional)** - Settings → Account Security → Enable MFA and set to "Action Based" for Waas Sign

## Dependencies

- `@dynamic-labs-sdk/client` - Core SDK
- `@dynamic-labs-sdk/evm` - EVM chain support
- `@dynamic-labs-sdk/solana` - Solana chain support
- `@dynamic-labs-sdk/zerodev` - Account abstraction & gas sponsorship
- `@dynamic-labs/iconic` - Social provider icons
- `jose` - JWT signing for dev utilities
- `viem` - EVM utilities
- `@solana/web3.js` - Solana utilities
- `@tanstack/react-query` - Data fetching & mutations
- `qrcode.react` - QR code generation for MFA setup

## Webhooks

This demo includes a webhook endpoint at `/api/webhooks/dynamic` for receiving events from Dynamic.

### Setup

1. **Configure webhook in Dynamic Dashboard:**
   - Go to Developer Dashboard → Webhooks
   - Add endpoint URL: `https://your-domain.com/api/webhooks/dynamic`
   - Select events to subscribe to (e.g., `user.created`, `wallet.linked`)
   - Copy the webhook secret

2. **Add webhook secret to environment:**

   ```
   DYNAMIC_WEBHOOK_SECRET=your_webhook_secret_here
   ```

### Local Development

To test webhooks locally, you need to expose your local server to the internet. Options:

- **[ngrok](https://ngrok.com/)** - `ngrok http <port>` → use the generated URL
- **[localtunnel](https://localtunnel.github.io/www/)** - `npx localtunnel --port <port>`
- **[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)**

Example with ngrok:

```bash
# Terminal 1: Start your app
pnpm dev

# Terminal 2: Expose to internet (use your dev server port)
ngrok http 3001
# Output: https://abc123.ngrok-free.app → http://localhost:3001

# Use https://abc123.ngrok.io/api/webhooks/dynamic as your webhook URL
```

### Signature Verification

The endpoint verifies webhook signatures using HMAC SHA256:

```typescript
// app/api/webhooks/dynamic/route.ts
const isValid = verifySignature({
  secret: webhookSecret,
  signature: request.headers.get("x-dynamic-signature"),
  payload,
});
```

If `DYNAMIC_WEBHOOK_SECRET` is not set, signature verification is skipped (useful for local development).

### Common Webhook Events

| Event                  | Description                    |
| ---------------------- | ------------------------------ |
| `user.created`         | New user signed up             |
| `user.session.created` | User logged in                 |
| `wallet.created`       | Embedded wallet created        |
| `wallet.linked`        | External wallet linked         |
| `wallet.transferred`   | Wallet transferred to new user |

See [Webhook Events](https://dynamic.xyz/docs/developer-dashboard/webhooks/events) for full list.

## Learn More

- [Dynamic JS SDK Documentation](https://www.dynamic.xyz/docs/javascript)
- [Embedded Wallets Guide](https://www.dynamic.xyz/docs/javascript/reference/waas/checking-if-waas-is-enabled)
- [ZeroDev Integration](https://www.dynamic.xyz/docs/javascript/reference/zerodev/adding-zerodev-extension)
- [Transaction History](https://www.dynamic.xyz/docs/javascript/reference/wallets/get-transaction-history)
- [Webhooks Overview](https://dynamic.xyz/docs/developer-dashboard/webhooks/overview)
- [Webhook Signature Verification](https://docs.dynamic.xyz/guides/webhooks-signature-validation)
