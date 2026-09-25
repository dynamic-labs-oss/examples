# EVM Server Wallet Examples

Single-operation examples for EVM server wallets — wallets your application owns and holds key shares for. For wallets a *user* has delegated to you, see [`delegated/`](delegated).

Default network is Base Sepolia (`DEFAULT_CHAIN` in `constants.ts`).

| Example | Command |
| --- | --- |
| [Wallet management](#wallet-management) | `pnpm evm:wallet` |
| [Send transaction](#send-transaction) | `pnpm evm:send-txn` |
| [Sign message](#sign-message) | `pnpm evm:sign-msg` |
| [Sign typed data](#sign-typed-data) | `pnpm evm:sign-typed-data` |

---

## Wallet management

`wallet.ts` — create, list, and delete server wallets.

```bash
pnpm evm:wallet --create                                    # ephemeral, not saved
pnpm evm:wallet --create --save                              # persist for reuse
pnpm evm:wallet --create --save --threshold 3                # 2-of-3 instead of 2-of-2
pnpm evm:wallet --create --save --backup --password secret   # shares backed up to Dynamic
pnpm evm:wallet --list
pnpm evm:wallet --delete 0x123...
```

| Flag | Notes |
| --- | --- |
| `--create` / `--list` / `--delete <addr>` | One is required |
| `--save` | Persists `walletMetadata` + key shares locally |
| `--threshold 2\|3` | Defaults to `2` |
| `--backup` | Backs shares up to Dynamic. **Requires `--password`** — v1 rejects it otherwise |
| `--password <pw>` | Encrypts the backup; also needed later to sign |

Wallets are stored via `src/lib/wallet-storage.ts` — an unencrypted local JSON file, **for development only**. `--list` filters to EVM wallets; SVM wallets share the same file.

> **Persist the whole `walletMetadata`.** The SDK is stateless and needs it back on every signing call, and it cannot be reliably re-fetched later. Trimming it to the type-required fields fails at runtime — see the main [README](../../README.md#persisting-wallets).

---

## Send transaction

`send-transaction.ts` — sends 0 value to the zero address, either paying gas or having Dynamic sponsor it.

```bash
pnpm evm:send-txn standard                              # wallet pays its own gas
pnpm evm:send-txn gasless                               # Dynamic sponsors
pnpm evm:send-txn gasless --address 0x123...
pnpm evm:send-txn gasless --order-id order-1            # idempotent: safe to retry
```

| Mode | Needs |
| --- | --- |
| `standard` | Base Sepolia ETH in the wallet |
| `gasless` | Gas sponsorship enabled for your environment (enterprise) |

Gasless keeps the wallet's own address as sender — no smart-account wrapper — so both modes transact from the same address. The wallet's **first** sponsored transaction also signs its one-time EIP-7702 delegation, so expect it to be slower than later ones.

`--order-id` opts into idempotency by deriving the intent nonce from it. Without it, each call gets a fresh random nonce and a retry would double-execute. Note this layer alone fails *loudly* on a retry (`SMART_CONTRACT_EXECUTION_FAILED`) rather than reporting "already done" — see [IDEMPOTENCY.md](../../IDEMPOTENCY.md).

---

## Transfer token

`transfer-token.ts` — moves an ERC-20 balance. Defaults to a 0-amount self-transfer of the example USDC, so it runs with no arguments and no funding.

```bash
pnpm evm:transfer-token                                 # 0 USDC to self, wallet pays gas
pnpm evm:transfer-token --to 0xRecipient --amount 1.5
pnpm evm:transfer-token --token 0xToken --amount 10
pnpm evm:transfer-token --sponsored                     # Dynamic pays gas
```

| Flag | Default | Notes |
| --- | --- | --- |
| `--to` | the wallet itself | A self-transfer is always a valid recipient |
| `--amount` | `0` | Whole units (`1.5`), not base units |
| `--token` | example USDC | Any ERC-20 on this chain |
| `--sponsored` | off | Wallet needs no ETH |

Where a native send puts value in the transaction's `value` field, a token transfer calls the contract: `to` is the token, `value` is `0`, and the recipient and amount are in the calldata.

`decimals()` is read from the contract, so `--amount` is in whole units. An amount the token can't represent is **rejected** rather than rounded — viem's `parseUnits` would turn `1.999999999` into `2` at 6 decimals, silently moving more than you asked.

Not retry-safe on its own: call it twice and it transfers twice. Use `pnpm example:transfer --token ...` when you need idempotency.

---

## Sign message

`sign-message.ts` — ECDSA `personal_sign`, off-chain, no sponsorship needed.

```bash
pnpm evm:sign-msg "Hello, World!"
pnpm evm:sign-msg "Hello, World!" --address 0x123...
pnpm evm:sign-msg "Hello, World!" --address 0x123... --password secret
```

Useful for proving wallet ownership, signing session data, or authorising off-chain actions.

---

## Sign typed data

`sign-typed-data.ts` — EIP-712 structured data signing over a sample `Mail` payload.

```bash
pnpm evm:sign-typed-data
pnpm evm:sign-typed-data --address 0x123... --password secret
```

The usual applications are ERC-20 `permit` approvals, meta-transactions, and off-chain order signing for DEXes or marketplaces. Note Dynamic's own gasless flow uses EIP-712 internally to sign the `AuthorizedExecutions` intent.
