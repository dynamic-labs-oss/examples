# Delegated Wallet Examples

These examples demonstrate how to use delegated wallets - wallets where another user has granted your application permission to sign transactions on their behalf.

Transactions here are **gasless**: gas is sponsored by Dynamic, so the user never needs a native token balance. The transaction still originates from the user's own address — delegation changes who signs, not whose account it is.

## Prerequisites

Delegated wallets require a `wallet.json` file containing credentials obtained through a separate delegation process. This is different from server wallets where you control the key shares directly.

Gasless transactions additionally require **EVM Gas Sponsorship**, an enterprise feature. Enable it in the [Dynamic Dashboard](https://app.dynamic.xyz) under **Settings → Embedded Wallets**, and make sure the chain you're using is enabled. Message signing works without it.

### Required: wallet.json

Create a `wallet.json` file in this directory with the following structure:

```json
{
  "address": "0x...",
  "walletId": "wallet-uuid-here",
  "userId": "end-user-uuid-here",
  "walletApiKey": "api-key-here",
  "delegatedShare": "delegated-key-share-here",
  "shareSetId": "share-set-uuid-here"
}
```

See `wallet.json.example` for a template.

`shareSetId` is optional — omit it and Dynamic resolves the correct share set from `walletId`. When you do supply it, use the `shareSetId` from the `wallet.delegation.created` webhook payload, not `keyShares[].id` from a `byWalletAddress` lookup (those are different primary keys).

`userId` is the UUID of the end user who owns the wallet, from the same webhook payload. It is **required** for gas sponsorship: a delegated wallet always belongs to an end user, so a sponsored transaction has to be attributed to them rather than to the calling service.

> ⚠️ `walletApiKey` and `delegatedShare` are credentials that together can sign on the user's behalf. `wallet.json` is gitignored, but for anything beyond local testing keep them in a secrets manager (Vault, AWS/GCP Secret Manager) rather than on disk.

### How to Obtain Delegated Access

1. The wallet owner initiates delegation through your frontend application
2. They approve your application to sign on their behalf
3. Your `wallet.delegation.created` webhook receives the delegation credentials (`walletId`, `userId`, `walletApiKey`, key share, `shareSetId`)
4. Store these credentials securely for future use

## Available Scripts

### Sign a Message

```bash
pnpm evm:delegated:sign-msg "Hello, World!"
```

### Send a Gasless Transaction

```bash
pnpm evm:delegated:send-txn
```

### Sign Now, Relay Later

```bash
pnpm evm:delegated:send-txn --pre-sign
```

Stops after signing, prints the intent as plain JSON, then relays it. The two
halves are genuinely separable: signing needs the delegated credentials, relaying
needs only your environment API token, and the payload can travel between them as
JSON at any point inside `validForSeconds` (10 minutes by default).

`delegatedSignSponsoredTransaction` produces the same field set as the SDK's
`signSponsoredTransaction`, so the relay accepts either interchangeably. The plain
version can't be used here: it signs with caller-held key shares, which a delegated
wallet by definition does not have.

This mode also passes `autoDelegate: false`, so it needs no `RPC_URL` at all — the
signing half has no chain dependency. See [autoDelegate](#autodelegate-and-rpc_url).

## How Gasless Signing Works Here

For a **server wallet** you hold the key shares, so the SDK's `sendSponsoredTransaction` signs the sponsorship intent for you in one call.

A **delegated wallet's** share stays with Dynamic behind a wallet-scoped API key, so the intent can't be signed from caller-held shares. SDK 1.0.106 added a first-class API for exactly this case, and `src/lib/gasless/evm.ts` is a thin wrapper over it:

| | Signs | Relays |
| --- | --- | --- |
| `delegatedSendSponsoredTransaction` | ✅ | ✅ |
| `delegatedSignSponsoredTransaction` | ✅ | — (payload is yours to relay) |

One call does the whole thing: sign the intent with the user's delegated share, attribute it to `userId`, resolve the one-time EIP-7702 authorization if needed, relay through Dynamic's relayer, and poll `pending → submitted → success`.

### autoDelegate and `RPC_URL`

`autoDelegate` (on by default) signs the one-time EIP-7702 authorization for you the first time a wallet is sponsored. It is the *only* reason this path needs `RPC_URL`, and both of its calls are reads:

- `eth_getCode` — is the EOA already delegated to the gasless contract?
- `eth_getTransactionCount` — an EIP-7702 authorization commits to the EOA's current nonce.

The delegation lives on-chain, not in the Dynamic dashboard, which is why it can't be looked up through the API. Once a wallet is delegated, pass `autoDelegate: false` to skip the RPC entirely — that's what `--pre-sign` does. A wallet that *isn't* yet delegated will fail to send with `autoDelegate: false`.

## Security Considerations

- Store delegated credentials securely (encrypted at rest, in a secrets manager)
- Implement proper access controls
- Monitor and log all delegated operations
- Respect the scope of delegation granted by the user
- Provide users with the ability to revoke delegation (`revokeDelegation`)
- Sponsorship intents are valid for 10 minutes by default; shorten with `validForSeconds` if you pre-sign and relay later

## Comparison: Server Wallets vs Delegated Wallets

| Aspect          | Server Wallets                    | Delegated Wallets                       |
| --------------- | --------------------------------- | --------------------------------------- |
| Key Control     | You control key shares            | User controls, grants access            |
| Creation        | You create the wallet             | User creates, delegates to you          |
| Use Case        | Treasury, omnibus accounts        | User operations on their behalf         |
| Revocation      | N/A (you control)                 | User can revoke access                  |
| Gasless signing | `sendSponsoredTransaction`         | `delegatedSendSponsoredTransaction`     |
