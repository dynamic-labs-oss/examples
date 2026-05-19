# Dynamic Rust Server-Side Wallet Management

Server-side wallet management examples using Dynamic's Rust SDK
(`dynamic-waas-sdk`, `dynamic-waas-sdk-evm`, `dynamic-waas-sdk-svm`).
Demonstrates wallet creation, message signing, delegated wallet
operations, and webhook decryption.

> This example targets the v1 **stateless** SDK surface: every operation
> that touches an existing wallet takes explicit `WalletProperties` +
> `Vec<ServerKeyShare>` parameters. The SDK never holds per-wallet state
> across calls.

## Rust SDK Status (0.0.x)

The Rust SDK is published on crates.io as `0.0.3` (still pre-stable —
minor bumps may break compatibility until `0.1.0`). The high-level
chain-client wrappers (`DynamicEvmWalletClient`, `DynamicSvmWalletClient`)
only expose `create_wallet_account`, `sign_message`, and
`export_private_key` today, **but** the lower-level orchestration
primitives (`run_sign_ecdsa`, `run_sign_ed25519`,
`run_recover_key_shares`) are public and let you build everything else.

This example uses those primitives to implement the **full** Python / Go
parity surface:

| Capability                  | Implementation                                          |
| --------------------------- | ------------------------------------------------------- |
| EVM `sign_typed_data`       | EIP-712 hash via `alloy::dyn_abi::TypedData` → `run_sign_ecdsa` |
| EVM `sign_transaction`      | `TxLegacy::signature_hash()` → `run_sign_ecdsa` → `TxEnvelope::encoded_2718()` |
| EVM `send_transaction`      | Above + broadcast via `alloy::providers::ProviderBuilder` |
| SVM `sign_transaction`      | `solana_sdk::Message::serialize()` → `run_sign_ed25519`  |
| SVM `send_transaction`      | Above + broadcast via `solana_client::RpcClient`         |
| EVM `run_recover_key_shares`| Real impl using the top-level orchestrator              |
| `decrypt_delegated_webhook_data` | Direct passthrough to the SDK                      |
| `sponsor_transaction` (SVM) | **Not** wired in — SDK doesn't expose it yet            |

When the SDK ships the high-level chain-client equivalents in a future
release, the binaries in `src/bin/` can be migrated from the primitive
calls to the wrapper calls without changing the example layout.

> **Signing transactions and typed data in 0.0.3.** The chain-client
> convenience methods `sign_transaction` and `sign_typed_data` aren't on
> `DynamicEvmWalletClient` / `DynamicSvmWalletClient` yet, but the
> underlying MPC orchestrators are public and ready to use:
>
> - **EVM** — `run_sign_ecdsa` + `SignOpts` + `mpc_config::EVM_DERIVATION_PATH`.
>   Compute the digest yourself (EIP-191 personal_sign, EIP-712 typed-data
>   hash, or a legacy / EIP-1559 tx signing hash), sign it, then assemble
>   `(r, s, v)` with your tx encoder. See `src/bin/evm-sign-transaction.rs`
>   and `src/bin/evm-sign-typed-data.rs`.
> - **SVM** — `run_sign_ed25519` + `SignOptsEd25519`. Pass the raw bytes
>   you want signed (e.g. a serialized Solana transaction message). See
>   `src/bin/svm-sign-transaction.rs`.
>
> Footgun warning: get the derivation path, the digest, or the
> `is_formatted` flag wrong and you'll produce a syntactically valid
> signature that recovers to the wrong address. Every binary here
> verifies by recovering the signer and asserting it matches
> `wp.account_address` before treating the signature as good — copy that
> pattern.

## Project Structure

```
rust-server-wallets/
├── Cargo.toml                            # Workspace + bin definitions
├── .env.example
├── wallet.json.example                   # Template for delegated credentials
└── src/
    ├── lib.rs                            # Module wiring
    ├── cli.rs                            # Tokio runtime + tracing init
    ├── config.rs                         # .env loading + constants
    ├── delegated.rs                      # wallet.json loader
    ├── dynamic.rs                        # Client factories
    ├── storage.rs                        # Local JSON store (.wallets.json)
    ├── utils.rs                          # Address formatting + explorer links
    ├── walletops.rs                      # Get-or-create helpers
    └── bin/
        ├── evm-wallet.rs                 # create / list / delete EVM wallets
        ├── evm-sign-message.rs           # EIP-191 personal_sign
        ├── evm-sign-typed-data.rs        # EIP-712 typed-data signing
        ├── evm-sign-transaction.rs       # Sign legacy tx, no broadcast
        ├── evm-send-transaction.rs       # Sign + broadcast (Base Sepolia)
        ├── evm-recover-key-shares.rs     # Recover shares from password backup
        ├── svm-wallet.rs                 # create / list / delete SVM wallets
        ├── svm-sign-message.rs           # Ed25519 message signing (base58)
        ├── svm-sign-transaction.rs       # Sign Solana tx, no broadcast
        ├── svm-send-transaction.rs       # Sign + broadcast (Solana devnet)
        ├── delegated-sign-message.rs     # Sign via a delegated wallet
        ├── delegated-decrypt-webhook.rs  # Unwrap encrypted webhook payload
        └── omnibus-sweep.rs              # Parallel wallet creation + signing
```

## SDK Method Coverage

| SDK method                                 | Demonstrated by                  |
| ------------------------------------------ | -------------------------------- |
| `DynamicWalletClient::authenticate_api_token` | `src/dynamic.rs`              |
| EVM `create_wallet_account`                | `src/bin/evm-wallet.rs`          |
| EVM `sign_message`                         | `src/bin/evm-sign-message.rs`    |
| SVM `create_wallet_account`                | `src/bin/svm-wallet.rs`          |
| SVM `sign_message`                         | `src/bin/svm-sign-message.rs`    |
| `DelegatedEvmWalletClient::sign_message`   | `src/bin/delegated-sign-message.rs` |
| `DelegatedSvmWalletClient::sign_message`   | `src/bin/delegated-sign-message.rs` |
| `decrypt_delegated_webhook_data`           | `src/bin/delegated-decrypt-webhook.rs` |
| `run_recover_key_shares`                   | `src/bin/evm-recover-key-shares.rs` |

## Technical Stack

- **[Dynamic Rust SDK](https://github.com/dynamic-labs/dynamic-waas-sdk/tree/main/rust)**
  (`dynamic-waas-sdk`, `dynamic-waas-sdk-evm`, `dynamic-waas-sdk-svm`).
- **Rust 1.90+** (workspace requirement from the SDK).
- **Tokio** multi-thread runtime, **clap** for CLI parsing, **dotenvy**
  for `.env` loading, **tracing** for logs.

## Prerequisites

- Rust 1.90 or later (install via [rustup.rs](https://rustup.rs/)).
- Dynamic API credentials ([app.dynamic.xyz](https://app.dynamic.xyz/)).
- Optional but recommended:
  - An EVM RPC URL (Base Sepolia) for when send-transaction lands.
  - A Solana devnet RPC URL for the SVM demos.

## Setup

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

Required:

```env
DYNAMIC_API_TOKEN=your_dynamic_api_token
DYNAMIC_ENV_ID=your_environment_id

# Optional — target preprod (defaults to production):
# DYNAMIC_BASE_API_URL=https://app.dynamic-preprod.xyz
```

### 2. Build

```bash
cargo build
```

`Cargo.toml` pins `dynamic-waas-sdk*` to `=0.0.3` (the version this
example was authored against). When the SDK ships `0.1.0`, bump and
remove the `=` so cargo picks up patch updates.

If you want to develop against an unreleased SDK branch, add a temporary
`[patch.crates-io]` block to `Cargo.toml`:

```toml
[patch.crates-io]
dynamic-waas-sdk      = { path = "../../../dynamic-waas-sdk/server-packages/rust/crates/dynamic-waas-sdk" }
dynamic-waas-sdk-evm  = { path = "../../../dynamic-waas-sdk/server-packages/rust/crates/dynamic-waas-sdk-evm" }
dynamic-waas-sdk-svm  = { path = "../../../dynamic-waas-sdk/server-packages/rust/crates/dynamic-waas-sdk-svm" }
```

## Running the Examples

`cargo run --bin <name>` runs an individual binary. Pass arguments after
`--`:

### EVM Wallet Management

```bash
cargo run --bin evm-wallet -- --create
cargo run --bin evm-wallet -- --create --save
cargo run --bin evm-wallet -- --create --save --backup --password myPassword
cargo run --bin evm-wallet -- --list
cargo run --bin evm-wallet -- --delete 0x123...
```

### EVM Message Signing

```bash
cargo run --bin evm-sign-message -- "Hello, World"
cargo run --bin evm-sign-message -- "Hello, World" --address 0x123...
```

### EVM Typed Data (EIP-712)

```bash
cargo run --bin evm-sign-typed-data
cargo run --bin evm-sign-typed-data -- --address 0x123...
```

Computes the EIP-712 digest locally via `alloy::dyn_abi::TypedData`,
signs via the SDK's `run_sign_ecdsa`, and recovers the signer to verify.

### EVM Transaction Signing (no broadcast)

```bash
cargo run --bin evm-sign-transaction
cargo run --bin evm-sign-transaction -- --address 0x123...
```

Builds a `TxLegacy` (Base Sepolia), signs via `run_sign_ecdsa`, attaches
the `(r, s, v)`, and prints the raw EIP-2718-encoded transaction.

### EVM Send Transaction (sign + broadcast)

```bash
cargo run --bin evm-send-transaction
cargo run --bin evm-send-transaction -- --address 0x123...
```

Requires `EVM_RPC_URL` in `.env`. Fetches live nonce + gas price from the
RPC, signs, and broadcasts via `alloy::providers::ProviderBuilder`.

### EVM Key Share Recovery

```bash
cargo run --bin evm-recover-key-shares -- \
    --wallet-id <uuid> \
    --password mySecretPassword \
    --key-share-id <ks-uuid>
```

`wallet-id` and `key-share-id` come from the original backup — the Node
and Python SDKs read them out of
`wallet_properties.external_server_key_shares_backup_info.backups["dynamic"]`.

### Solana Wallet Management

```bash
cargo run --bin svm-wallet -- --create --save
cargo run --bin svm-wallet -- --list
cargo run --bin svm-wallet -- --delete <address>
```

### Solana Message Signing

```bash
cargo run --bin svm-sign-message -- "Hello, Solana"
cargo run --bin svm-sign-message -- "Hello, Solana" --address <address>
```

### Solana Transaction Signing (no broadcast)

```bash
cargo run --bin svm-sign-transaction
cargo run --bin svm-sign-transaction -- --address <address>
```

Builds a 0-lamport self-transfer message via `solana_sdk`, signs via
`run_sign_ed25519`, and prints the wire transaction.

### Solana Send Transaction (sign + broadcast)

```bash
cargo run --bin svm-send-transaction
cargo run --bin svm-send-transaction -- --address <address>
```

Requires `SOLANA_RPC_URL` in `.env`. Fetches a fresh blockhash, signs,
and broadcasts via `solana_client::nonblocking::rpc_client::RpcClient`.

> `--sponsored` is **not** supported — the Rust SDK 0.0.3 doesn't expose
> `sponsor_transaction` yet.

### Delegated Wallet Operations

Copy the credentials template and fill in the values produced by your
delegation webhook handler:

```bash
cp wallet.json.example wallet.json
# Edit wallet.json with your delegated credentials
```

Then sign:

```bash
cargo run --bin delegated-sign-message -- "Hello, World!" --wallet ./wallet.json
```

For decrypting webhook payloads:

```bash
# Demo mode (no args): prints the API surface
cargo run --bin delegated-decrypt-webhook

# Live decryption
cargo run --bin delegated-decrypt-webhook -- \
    --rsa-key ./private.pem \
    --payload ./webhook.json
```

### End-to-End: Omnibus Sweep

```bash
cargo run --bin omnibus-sweep
cargo run --bin omnibus-sweep -- --wallets 20
```

> The Rust version of this demo currently signs **messages** in place of
> transactions. Now that `evm-sign-transaction` works against the SDK,
> upgrading the omnibus demo to sign real ERC-20 transfers is a follow-up.

### Smoke Test

End-to-end verification mirroring `python-server-wallets/smoke_test.py`.
Walks the full lifecycle for each SDK surface (create, sign, verify
off-chain, EIP-712 typed data, transaction signing, storage round-trip,
recover-from-backup, threshold schemes), reporting PASS / FAIL per
sub-test.

```bash
cargo run --example smoke_test            # default: EVM + Solana
cargo run --example smoke_test -- --evm   # EVM only
cargo run --example smoke_test -- --svm   # Solana only
```

> Note: the Rust flag semantics differ from Python's `smoke_test.py`.
> Python uses `--svm` as **additive** ("EVM + Solana"); Rust treats
> `--evm` and `--svm` as **mutually exclusive filters** and runs both
> chains by default.

Requires `DYNAMIC_API_TOKEN` and `DYNAMIC_ENV_ID` in `.env`. Each run
creates real MPC wallets against Dynamic — by default production. Set
`DYNAMIC_BASE_API_URL=https://app.dynamic-preprod.xyz` to target preprod.

All sub-tests except SVM `sponsor_transaction` exercise real SDK paths —
including `sign_typed_data` and `sign_transaction` via the lower-level
orchestration primitives. See the
[SDK Status](#rust-sdk-status-00x) table for which wrappers are still
synthesised from `run_sign_ecdsa` / `run_sign_ed25519` directly.

## Sample Output

### Wallet Creation

```
Creating EVM server wallet (TWO_OF_TWO)...
Server wallet created in 2.34s
Address: 0x7E3629...5A02f0
Wallet ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Wallet saved to .wallets.json
```

### Message Signing

```
Signing message...

Message signed in 1.45s
Message: "Hello, World"
Signature: 0xabc123...def456
Signer: 0x7E3629...5A02f0
```

## Production Notes

- `.wallets.json` is **for testing only** — key shares are stored
  unencrypted. In production, persist `WalletProperties` in your service
  database and `Vec<ServerKeyShare>` in a KMS / Vault.
- Never commit `.env` or `wallet.json`. Both are in `.gitignore`.
- The `DecryptedWebhookData` type has a redacted `Debug` impl — prefer
  `println!("{:?}", data)` over manual formatting that might log secrets.
- Pin the SDK to a tagged release once one is published; do not ship
  against unreleased branches.
