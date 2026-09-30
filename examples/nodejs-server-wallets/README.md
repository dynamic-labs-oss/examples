# Dynamic Server-Side Wallet Management

Comprehensive server-side wallet management examples using Dynamic's SDK. From basic wallet operations to complex fund aggregation patterns, these examples demonstrate how to build secure, scalable financial infrastructure.

Gas sponsorship uses **Dynamic's native EVM gas sponsorship** — no ERC-4337 bundler, paymaster, or smart account wrapper. Sponsored and unsponsored transactions come from the same wallet address.

## 📁 Project Structure

```
src/
├── evm/                        # EVM server wallet operations
│   ├── README.md               # EVM examples guide
│   ├── wallet.ts               # Create, list, delete wallets
│   ├── send-transaction.ts     # Send txns (standard or gasless)
│   ├── transfer-token.ts       # Transfer ERC-20 tokens
│   ├── sign-message.ts         # Sign messages for authentication
│   ├── sign-typed-data.ts      # Sign EIP-712 structured data
│   └── delegated/              # EVM delegated wallet operations
│       ├── README.md           # Prerequisites and how the intent is built
│       ├── credentials.ts      # Loads delegation credentials
│       ├── send-transaction.ts # Gasless txn with delegated access
│       ├── sign-message.ts     # Sign message with delegated access
│       └── wallet.json.example # Template for delegated credentials
│
├── svm/                        # Solana server wallet operations
│   ├── README.md               # SVM examples guide + EVM/SVM differences
│   ├── wallet.ts               # Create, list, delete wallets
│   ├── send-transaction.ts     # Send txns (standard or gasless)
│   ├── transfer-token.ts       # Transfer SPL tokens
│   ├── sign-message.ts         # Sign messages (Ed25519, base58)
│   ├── transaction.ts          # Demo transaction builder
│   └── delegated/              # Solana delegated wallet operations
│       ├── README.md           # Prerequisites and EVM/SVM comparison
│       ├── credentials.ts      # Loads delegation credentials
│       ├── send-transaction.ts # Gasless txn with delegated access
│       ├── sign-message.ts     # Sign message with delegated access
│       └── wallet.json.example # Template for delegated credentials
│
├── examples/                   # End-to-end workflow demos
│   ├── README.md               # End-to-end examples guide
│   ├── omnibus-sweep.ts        # EVM fund aggregation pattern
│   ├── idempotency/            # Safe retries for sponsored txns (EVM + SVM)
│   └── unified-transfer.ts     # Chain-agnostic idempotent transfer
│
├── smoke.ts                    # Smoke test runner (pnpm smoke)
│
└── lib/                        # Shared utilities
    ├── clients/                # Dynamic client factories (+ SOL balance read)
    │   ├── evm.ts
    │   └── svm.ts
    ├── gasless/                # Native gas sponsorship (+ nonce derivation)
    │   ├── evm.ts
    │   └── svm.ts
    ├── token/                  # Token metadata (decimals, memoized)
    │   ├── evm.ts
    │   └── svm.ts
    ├── transfer/               # Unified idempotent transfer
    │   ├── index.ts            # Dispatcher (chain-agnostic)
    │   ├── types.ts            # Shared contract + record shapes
    │   ├── evm.ts              # EVM adapter
    │   ├── svm.ts              # SVM adapter
    │   └── store.ts            # Idempotency records (dev only)
    ├── cli.ts                  # CLI helpers (runScript, parseArgs)
    ├── delegated-credentials.ts # Shared wallet.json loader
    ├── utils.ts                # Formatting and explorer links
    ├── wallet-helpers.ts       # Wallet retrieval (chain-agnostic)
    └── wallet-storage.ts       # Local JSON storage (dev only)
```

`constants.ts` sits at the package root and holds credentials, RPC URLs,
`DEFAULT_CHAIN`, and contract addresses — everything read from the environment.

Each example directory has its own README with full flag reference:

| Directory | Covers |
| --------- | ------ |
| [`src/evm/`](src/evm/README.md) | EVM wallets, sends, message + EIP-712 signing |
| [`src/evm/delegated/`](src/evm/delegated/README.md) | EVM delegated access, and how the gasless intent is assembled |
| [`src/svm/`](src/svm/README.md) | Solana wallets, sends, signing — and how SVM sponsorship differs |
| [`src/svm/delegated/`](src/svm/delegated/README.md) | Solana delegated access, sponsor-then-sign |
| [`src/examples/`](src/examples/README.md) | Unified transfer, idempotency, omnibus sweep |
| [IDEMPOTENCY.md](IDEMPOTENCY.md) | Retry safety on both chains |

## 🎯 What You'll Learn

### Server Wallet Operations (`src/evm/`, `src/svm/`)

- Create ephemeral or persistent server-side wallets on either chain
- Password protection for enhanced security
- List and manage saved wallets with local storage
- Send transactions with or without gas sponsorship
- Transfer ERC-20 and SPL tokens, with decimals read from chain
- Sign messages, and EIP-712 typed data on EVM

### Delegated Wallet Operations (`src/evm/delegated/`, `src/svm/delegated/`)

- Use wallets where users have granted delegation access
- Sign and send gasless transactions on behalf of users
- Understand the delegation credential flow

### End-to-End Examples (`src/examples/`)

- **Omnibus Sweep**: Create multiple customer wallets, fund them, and sweep all funds to a centralized omnibus account — gaslessly, so customer wallets never need ETH. EVM only.

## ⛽ How Gasless Works

Both chains are sponsored natively by Dynamic, but the mechanisms are genuinely different — worth understanding before you pick one as a mental model for the other.

### EVM: signed intent + relayer

A sponsored transaction is a batch of `{ target, data, value }` calls that Dynamic submits on the wallet's behalf:

1. The wallet's EOA is delegated **once** to Dynamic's gasless delegate contract via an EIP-7702 authorization. This persists on-chain and is reused afterwards.
2. The wallet signs an EIP-712 `AuthorizedExecutions` intent binding the calls to a specific relayer and a deadline.
3. Dynamic's relayer submits it and reports `pending → submitted → success` (or `failure`).

### SVM: fee payer replacement

Simpler — no delegation contract, no intent, no relayer:

1. Dynamic takes the unsigned transaction and swaps the **fee payer** for its own sponsor account, signing as that fee payer.
2. The wallet signs the resulting message.
3. **Your server** broadcasts the transaction.

Sponsorship must happen *before* signing, since replacing the fee payer changes the message being signed.

### Common to both

The wallet keeps its own address, so the sender is identical in sponsored and unsponsored modes — no smart-account indirection.

**Server wallets** use the SDK's built-in support. **Delegated wallets** split signing from sponsorship, because the delegated key share lives with Dynamic rather than with you. See [`src/evm/delegated/README.md`](src/evm/delegated/README.md) and [`src/svm/delegated/README.md`](src/svm/delegated/README.md) for how each is assembled and why.

| Aspect         | EVM                                 | SVM                            |
| -------------- | ----------------------------------- | ------------------------------ |
| Mechanism      | EIP-7702 delegation + signed intent | Fee payer replacement          |
| One-time setup | EIP-7702 authorization per wallet   | None                           |
| Who broadcasts | Dynamic's relayer                   | Your server                    |
| Signature type | ECDSA (hex)                         | Ed25519 (base58)               |
| Test network   | Base Sepolia                        | Solana devnet                  |

## 🛡️ Security Features

- **2-of-2 threshold signatures**: Requires both server and client approval
- **Per-account password**: Optional password protection for each wallet
- **TSS-MPC architecture**: Distributed key management for enhanced security
- **Flexible key management**: Dynamic manages client shares or self-manage
- **No raw private keys**: The SVM delegated example uses Dynamic as fee payer rather than the "custom fee payer" pattern, which would require holding a funded Solana keypair

## 🏗️ Technical Stack

- **Dynamic SDK v1**: Server-side wallet creation, signing, and native gas sponsorship
- **Viem**: Ethereum transaction encoding and blockchain interaction
- **@solana/web3.js**: Solana transaction building and broadcasting
- **Base Sepolia + Solana devnet**: Test environments

## 📋 Prerequisites

- Node.js 18+ and pnpm
- Dynamic API credentials
- **Gas sponsorship enabled** for gasless transactions, toggled in the [Dynamic Dashboard](https://app.dynamic.xyz) under **Settings → Embedded Wallets**. Only V3 MPC embedded wallets are supported.
  - **EVM** sponsorship is an enterprise feature, and the chain needs a Dynamic relayer (Base Sepolia and Ethereum Sepolia on testnet).
- For `standard` (non-sponsored) sends only: a funded wallet — Base Sepolia ETH or devnet SOL. Gasless modes need no balance.

## ⚙️ Setup

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Configure environment**:

   ```bash
   cp .example.env .env
   # Edit .env with your credentials
   ```

   | Variable                 | Required | Description                                                                                                     |
   | ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------- |
   | `DYNAMIC_API_TOKEN`      | Yes      | Environment API token from the Dynamic dashboard                                                                |
   | `DYNAMIC_ENVIRONMENT_ID` | Yes      | Your Dynamic environment ID                                                                                     |
   | `RPC_URL`                | For EVM  | Read-only EVM RPC, used for EIP-7702 delegation checks, EOA nonces, and receipts. No public fallback — see below |
   | `SOLANA_RPC_URL`         | No       | Solana RPC — used for reads **and** broadcasting. Defaults to public devnet (rate limited)                       |
   | `SOLANA_CLUSTER`         | No       | Cluster label for explorer links. Defaults to `devnet`                                                          |

   `RPC_URL` has no default on purpose: the public Base Sepolia endpoint is heavily rate limited and
   intermittently unavailable, which makes a correct setup look broken. Point it at a provider you
   control. The Solana examples, message signing, and wallet management don't need it.

## 🎯 Running the Examples

Every command is namespaced by chain: `evm:*` and `svm:*`. The two sets mirror each other, so anything below works on either chain unless noted.

### Wallet Management

```bash
# Create ephemeral wallet (not saved)
pnpm evm:wallet --create
pnpm svm:wallet --create

# Create and save wallet for reuse
pnpm evm:wallet --create --save

# Create with 2-of-3 threshold
pnpm evm:wallet --create --save --threshold 3

# Create with key shares backed up to Dynamic (--password is required with --backup)
pnpm evm:wallet --create --save --backup --password mySecretPassword

# List saved wallets (filtered to that chain; svm:wallet also shows SOL balance)
pnpm evm:wallet --list
pnpm svm:wallet --list

# Delete a saved wallet
pnpm evm:wallet --delete 0x123...
pnpm svm:wallet --delete <base58-address>
```

### Message Signing

```bash
# Sign with new ephemeral wallet
pnpm evm:sign-msg "Hello, World"
pnpm svm:sign-msg "Hello, World"          # Ed25519, base58 signature

# Sign with saved wallet
pnpm evm:sign-msg "Hello, World" --address 0x123...

# Sign with password-protected wallet
pnpm evm:sign-msg "Hello, World" --address 0x123... --password myPassword

# Sign EIP-712 typed data (EVM only)
pnpm evm:sign-typed-data --address 0x123...
```

### Send Transactions

```bash
# Standard transaction (wallet pays its own fee — needs a funded wallet)
pnpm evm:send-txn standard
pnpm svm:send-txn standard

# Gasless transaction (sponsored by Dynamic — no balance needed)
pnpm evm:send-txn gasless
pnpm svm:send-txn gasless

# Use saved wallet
pnpm evm:send-txn gasless --address 0x123...

# Use password-protected wallet
pnpm evm:send-txn gasless --address 0x123... --password myPassword

# Opt in to idempotency — safe to retry (both chains)
pnpm evm:send-txn gasless --order-id order-1
pnpm svm:send-txn gasless --order-id order-2
```

### Transfer Tokens

Native value moves in a transaction's `value` field; a token balance is state inside
a contract, so moving it means calling that contract. These mirror the sends above.

```bash
# 0-amount self-transfer of the example USDC — runs with no funding
pnpm evm:transfer-token
pnpm svm:transfer-token

# Real amounts. Decimals are read from the token, so --amount is in whole units
pnpm evm:transfer-token --to 0xRecipient --amount 1.5
pnpm svm:transfer-token --to <base58> --amount 1.5

# Pick the token (SVM also accepts --mint)
pnpm evm:transfer-token --token 0xToken --amount 10
pnpm svm:transfer-token --mint <mint> --amount 10

# Dynamic pays the fee, so the wallet needs no native balance
pnpm evm:transfer-token --sponsored
pnpm svm:transfer-token --sponsored
```

Neither is retry-safe on its own — a repeated call transfers again. For that use
[`pnpm example:transfer --token ...`](#unified-transfer-chain-agnostic), which adds
idempotency on top.

On Solana a token balance lives in a per-(owner, mint) **associated token account**
rather than the wallet, and both sides need one. Creating one costs rent, which
sponsorship doesn't cover, so a missing account is a clear error rather than
something the script creates.

### Delegated Wallet Operations

> ⚠️ Requires that chain's `wallet.json` with delegated credentials:
> `src/evm/delegated/wallet.json` or `src/svm/delegated/wallet.json`.
> They are **separate** — an EVM delegation can't sign Solana transactions.
> See the delegated README in each directory for setup.

```bash
# Sign message with delegated wallet
pnpm evm:delegated:sign-msg "Hello, World!"
pnpm svm:delegated:sign-msg "Hello, World!"

# Send gasless transaction with delegated wallet
pnpm evm:delegated:send-txn
pnpm svm:delegated:send-txn

# Sign now, relay later: prints the signed intent as JSON, then relays it.
# Signing needs the delegated credentials; relaying needs only the API token.
pnpm evm:delegated:send-txn --pre-sign
```

Delegated sponsorship uses the SDK's delegated gasless API (`delegatedSendSponsoredTransaction`,
new in 1.0.106). On EVM it auto-signs the one-time EIP-7702 authorization on first use, which is
the only reason that path needs `RPC_URL` — details in
[`src/evm/delegated/README.md`](src/evm/delegated/README.md#autodelegate-and-rpc_url).

### End-to-End Examples

```bash
# Omnibus sweep with default settings (10 wallets) — EVM only
pnpm example:omnibus

# Omnibus sweep with custom number of wallets
pnpm example:omnibus 20
```

### Unified Transfer (chain-agnostic)

One command, one set of flags, either chain. `src/lib/transfer/index.ts` presents a single call shape and picks the right mechanism underneath — the two chains need opposite handling for idempotency, and this is where that lives.

```bash
# native asset — same flags on both chains
pnpm example:transfer --chain evm --to 0xRecipient --amount 0.0001 --idempotency-key order-1
pnpm example:transfer --chain svm --to <base58>    --amount 0.001  --idempotency-key order-2

# token (ERC-20 or SPL) — same shape again
pnpm example:transfer --chain evm --to 0xRecipient --amount 5 \
  --token 0x678d798938bd326d76e5db814457841d055560d0 --decimals 6 --idempotency-key order-3

# delegated wallet instead of a server wallet
pnpm example:transfer --chain evm --delegated --to 0xRecipient --amount 0.0001 --idempotency-key order-4
```

Always idempotent — re-running with the same `--idempotency-key` reports a no-op instead of transferring again. Amounts are decimal strings in whole units. `--decimals` is optional: omitted, it is read from the token contract / mint; supplied, it is verified against the chain and a mismatch refuses the transfer.

Covers fungible transfers only (native, ERC-20, SPL). SPL transfers need the recipient's associated token account to already exist, since sponsorship covers fees but not account rent. See [IDEMPOTENCY.md](IDEMPOTENCY.md).

### Idempotent Retries

> ⚠️ **If you retry sponsored transactions, read [IDEMPOTENCY.md](IDEMPOTENCY.md).**
> The default call path is **not** safe to retry — it generates a fresh random
> nonce per call, so two attempts at the same operation can both land on-chain.

```bash
pnpm example:idempotency --order-id order-123                 # EVM, first run: executes
pnpm example:idempotency --order-id order-123                 # again: no-op, delta 0
pnpm example:idempotency --order-id order-123 --force         # bypass bookkeeping (needs a prior attempt)
pnpm example:idempotency --chain svm --order-id order-456     # SVM: signed-bytes replay
```

Mints test USDC, so a double execution would show up as double the balance. Re-run with the same `--order-id` as often as you like — the balance only moves once.

Two layers, both wanted: a **nonce derived** from your business key (the chain admits it once) and a **persisted `requestId`** (ask what happened before retrying). EVM and SVM differ substantially here — on SVM the safe unit is the signed bytes, not a nonce, and it is *rebuilding* rather than re-signing that double-executes. [IDEMPOTENCY.md](IDEMPOTENCY.md) covers both, with the measurements behind each claim.

## ✅ Smoke Tests

`pnpm smoke` runs the example entrypoints in one pass and reports pass/fail per step. Steps are grouped by cost, and the expensive tiers are opt-in:

```bash
pnpm smoke                      # offline only — type-check + arg validation, no credentials
pnpm smoke --signing            # + off-chain signing (needs DYNAMIC_* credentials)
pnpm smoke --onchain            # + sponsored transactions (SPENDS sponsorship budget)
pnpm smoke --all                # everything
pnpm smoke --all --delegated    # also the delegated wallet steps
```

Both chains run by default. Narrow with `--evm` or `--svm`:

```bash
pnpm smoke --svm --signing      # Solana signing steps only
```

| Tier | Needs | Side effects |
| ---- | ----- | ------------ |
| `offline` (always) | nothing | none |
| `signing` | `DYNAMIC_*` credentials | creates wallets via the API |
| `onchain` | sponsorship enabled | broadcasts real transactions, consumes budget |

Delegated steps require that chain's `wallet.json` and are opt-in via `--delegated` so a fresh clone stays green. If a required file is missing the runner names it and exits rather than failing mid-run. Exits non-zero if any step fails.

A few things are deliberately **not** covered:

- **`standard` (non-sponsored) sends**, which need a funded wallet. Run `pnpm evm:send-txn standard` / `pnpm svm:send-txn standard` yourself.
- **The omnibus sweep**, which creates N+1 wallets and relays 2N sponsored transactions — too heavy for a smoke run. Use `pnpm example:omnibus 2`.
- **`svm:transfer-token` on chain.** A fresh wallet has no associated token account for the mint, and the script won't create one (rent isn't sponsored), so it can't run unattended. `evm:transfer-token --sponsored` *is* covered — an ERC-20 needs no per-holder account, so a 0-amount self-transfer works on a brand-new wallet.
- **`example:transfer` on chain.** It rejects an amount of zero, so it structurally needs a wallet that already holds the asset — which a fresh clone doesn't have. Only its argument handling is covered; run it yourself against a funded wallet:

  ```bash
  pnpm example:transfer --chain evm --address <addr> --to <addr> --amount 1 \
    --token <erc20> --idempotency-key key-1
  pnpm example:transfer --chain svm --address <addr> --to <addr> --amount 0.001 \
    --idempotency-key key-2
  ```

  Repeat either with the same `--idempotency-key` and it should report a no-op and hand back the original transaction id.

## 🔑 Persisting Wallets

The SDK is stateless: it keeps no wallet state between calls. Every signing operation takes the `walletMetadata` returned at creation, plus the key shares when you hold them.

Persist **both** at creation time:

- `walletMetadata` — non-sensitive identity and backup-pointer info. Safe in Redis/Postgres alongside normal application data.
- `externalServerKeyShares` — sensitive MPC material. Belongs in a vault (KMS, Vault). Empty when you back the shares up to Dynamic instead.

`walletMetadata` cannot be reliably reconstructed later: lookups like `fetchWalletMetadata` omit `externalServerKeySharesBackupInfo`, which signing with caller-held shares requires. Treat the object returned from `createWalletAccount` as recovery-critical.

### Pass `walletMetadata` whole — don't trim it

Tempting to reduce it to the fields TypeScript marks required. **That fails at runtime.** The type is inaccurate in both directions — measured against SDK 1.0.107 for `signMessage` with caller-held shares:

| Field | Type says | Actually needed |
| ----- | --------- | --------------- |
| `walletId` | required | ✅ yes |
| `accountAddress` | required | ✅ yes |
| `derivationPath` | *optional* | ✅ **yes** — omit it and the MPC ceremony fails on mismatched parameters |
| `externalServerKeySharesBackupInfo` | *optional* | ✅ **yes** |
| `chainName` | **required** | ❌ unused |
| `thresholdSignatureScheme` | **required** | ❌ unused |
| `shareSetId` | optional | ❌ unused for signing |

So the four type-required fields alone fail; you need `derivationPath` and `externalServerKeySharesBackupInfo`, both of which are typed optional and therefore unprotected by the compiler.

Three reasons to keep passing the whole object anyway:

1. **The minimal set isn't a contract.** It's observed behaviour, undocumented, and can change in a patch release.
2. **It varies by operation.** Signing needs those four. `refreshWalletAccountShares`, `reshare`, and `updatePassword` also need `shareSetId` / `shareSetType` / `otherShareSets`; BTC backups need `addressType`.
3. **The compiler won't warn you.** Trimming produces runtime failures during an MPC ceremony, not build errors.

These examples use `src/lib/wallet-storage.ts`, an unencrypted local JSON file, which is **for local development only**. EVM and SVM wallets share that file; each chain's `--list` filters on `walletMetadata.chainName` so you only see its own.

## 📊 Sample Output

### Wallet Creation

```
Creating server wallet...
✅ Server wallet created in 2.34s
📍 Address: 0x7E3629...5A02f0
💡 Tip: Add '--save' flag to persist wallet for reuse
```

### Message Signing

```
Signing message...

✅ Message signed in 1.45s
📝 Message: "Hello, World!"
✍️ Signature: 0xabc123...def456
👛 Signer: 0x7E3629...5A02f0
```

### Send Transaction (EVM)

```
Sending gasless transaction (sponsored by Dynamic)...

✅ Transaction sent in 6.12s
📝 Hash: 0x789...012
🔗 Explorer: https://sepolia.basescan.org/tx/0x789...012
💳 Mode: gasless
👛 Wallet: 0x7E3629...5A02f0
```

The first sponsored transaction from a wallet also signs its one-time EIP-7702 delegation, so it takes longer than later ones. SVM has no such setup step, so its first sponsored transaction is no slower than the rest.

### Send Transaction (SVM)

```
Sending gasless transaction (sponsored by Dynamic)...

✅ Transaction sent in 3.04s
📝 Signature: 5Nd8...kQ2p
🔗 Explorer: https://explorer.solana.com/tx/5Nd8...kQ2p?cluster=devnet
💳 Mode: gasless
👛 Wallet: 8FEy...vLq3
```

### Omnibus Sweep

```
Dynamic Gasless Transaction Demo - Omnibus Sweep
============================================================
Configuration: 10 wallets, funding random USDC amounts up to 1000
============================================================

Creating omnibus wallet for fund aggregation...
Omnibus wallet created: 0xbBdf18...c10B74

Creating 10 customer wallets...
Customer wallet 1 created: 0x7E3629...5A02f0
...

Funding 10 customer wallets with USDC tokens...
Funded customer wallet 1 (0x7E3629...5A02f0): 33 USDC
...

Sweeping funds from 10 customer wallets to omnibus account...
Swept customer wallet 1 (0x7E3629...5A02f0): 33 USDC to omnibus
...

============================================================
Demo completed successfully.
Total USDC transferred: 333 USDC
Omnibus wallet address: 0xbBdf18...c10B74
```

## 🩺 Troubleshooting

| Error                                                     | Cause                                                                                                           |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `sponsorship not enabled` / no relayer available          | Gas sponsorship isn't enabled for the environment, or the EVM chain has no Dynamic relayer                       |
| `MissingBackupInfoError`                                  | `walletMetadata` is missing `externalServerKeySharesBackupInfo` — persist the object from `createWalletAccount`   |
| `EVM sponsored transaction timed out ...`                 | The relay didn't reach a terminal status within 60s                                                              |
| `rpcUrl is required when autoDelegate is true`            | EVM sponsorship needs an RPC to read delegation state and EOA nonces                                             |
| Rate limit / timeout errors during `example:omnibus`      | Set `RPC_URL` to a dedicated provider instead of the public endpoint                                             |
| **SVM** `Missing signatures for: <address>`               | The instruction signer never signed — on the delegated path, check `signerAddress` is the user's address         |
| **SVM** `unknown signer`                                  | Attaching a signature for an account that isn't a required signer of the transaction                             |
| **SVM** `Blockhash not found` / expired                   | The blockhash aged out between building and broadcasting. Rebuild the transaction and retry                       |
| **SVM** wallet has no SOL on `standard` mode              | Expected — fund it with devnet SOL, or use `gasless`, which needs no balance                                     |
