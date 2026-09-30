# End-to-End Examples

Workflows that combine several primitives, as opposed to the single-operation examples in [`src/evm/`](../evm) and [`src/svm/`](../svm).

| Example | Command | Chain | Idempotent |
| --- | --- | --- | --- |
| [Unified transfer](#unified-transfer) | `pnpm example:transfer` | EVM + SVM | ✅ always |
| [Idempotent transfer](#idempotent-transfer) | `pnpm example:idempotency` | EVM + SVM | ✅ always |
| [Omnibus sweep](#omnibus-sweep) | `pnpm example:omnibus` | EVM | ❌ demo only |

All three need gas sponsorship enabled for your environment. See [IDEMPOTENCY.md](../../IDEMPOTENCY.md) for the retry-safety background.

---

## Unified transfer

`unified-transfer.ts` — one call shape for a gasless transfer on either chain, for native assets or tokens, signed by a server wallet or delegated credentials.

```bash
# native — identical flags on both chains
pnpm example:transfer --chain evm --to 0xRecipient --amount 0.0001 --idempotency-key order-1
pnpm example:transfer --chain svm --to <base58>    --amount 0.001  --idempotency-key order-2

# token (ERC-20 or SPL) — decimals read from chain
pnpm example:transfer --chain evm --to 0xRecipient --amount 5 \
  --token 0x678d798938bd326d76e5db814457841d055560d0 --idempotency-key order-3

# delegated wallet rather than a server wallet
pnpm example:transfer --chain evm --delegated --to 0xRecipient --amount 0.0001 --idempotency-key order-4
```

| Flag | Required | Notes |
| --- | --- | --- |
| `--chain` | yes | `evm` or `svm` |
| `--to` | yes | Recipient address |
| `--amount` | yes | Decimal string in whole units (`"1.5"`), not base units. Must be > 0, and the sender needs that balance — sponsorship covers the fee, not the amount ([funding a Solana wallet](../svm/README.md#funding-a-wallet-only-for-value-transfers)) |
| `--idempotency-key` | yes | Same key never executes twice |
| `--token` | no | ERC-20 address or SPL mint. Omit for the native asset |
| `--decimals` | no | Read from chain when omitted; supplied values are **verified**, and a mismatch refuses the transfer |
| `--address` | no | Sender. A new wallet is created when omitted |
| `--delegated` | no | Use delegated credentials instead of a server wallet |
| `--password` | no | For password-protected wallets |

**Why an abstraction at all.** The two chains need opposite handling for retry safety — EVM pins a derived nonce, SVM must never re-sign — and getting either backwards double-spends. Details in [`src/lib/transfer/index.ts`](../lib/transfer/index.ts).

**Adding a chain:** append to `SUPPORTED_CHAINS`, add a `case` to each `switch (chain)`, and give it a `NATIVE_DECIMALS` entry. The switches use an exhaustiveness check, so TypeScript fails the build at every site still needing work.

**Constraints:** fungible transfers only (no arbitrary contract calls), and SPL transfers require the recipient's associated token account to already exist — sponsorship covers fees, not account rent.

---

## Idempotent transfer

`idempotency/` — each chain's retry-safety mechanism in isolation, with both layers visible. A thin dispatcher (`index.ts`) plus one module per chain, because the two mechanisms share almost nothing.

```bash
# EVM (default) — mints test USDC, so a double execution would show as double the balance
pnpm example:idempotency --order-id order-123           # first run: executes
pnpm example:idempotency --order-id order-123           # again: no-op, delta 0
pnpm example:idempotency --order-id order-123 --force   # bypass the bookkeeping

# SVM — 0-lamport self-transfer; the observable is the signature, not a balance
pnpm example:idempotency --chain svm --order-id order-456
pnpm example:idempotency --chain svm --order-id order-456           # again: identical signature
pnpm example:idempotency --chain svm --order-id order-456 --force
```

| Flag | Required | Notes |
| --- | --- | --- |
| `--chain` | no | `evm` (default) or `svm` |
| `--order-id` | yes | Idempotency key. Cannot be reused across chains — the store keys on it alone |
| `--amount` | no | **EVM only.** Whole USDC to mint, default 10. Rejected on SVM |
| `--address` | no | Wallet to use |
| `--password` | no | For password-protected wallets |
| `--force` | no | Attempt a second execution, bypassing the bookkeeping. Requires a prior attempt under the same key |

### What each chain demonstrates

**EVM** — two layers: a nonce derived from `--order-id`, plus a persisted `requestId` polled before re-relaying. `--force` shows the on-chain nonce bitmap rejecting a replay (`SMART_CONTRACT_EXECUTION_FAILED`) even with the bookkeeping bypassed.

**SVM** — no nonce exists, so the signed bytes are the unit: sign once, persist, rebroadcast verbatim. A retry checks the recorded signature's on-chain status first and short-circuits without touching a wallet at all — rebroadcasting needs no key material. `--force` is the more interesting half, and it corrects a natural misconception in two steps:

1. Signing one message twice yields two different wallet signatures (MPC is non-deterministic) — but both share one transaction id, because the id is `signatures[0]`, the **sponsor's** signature as fee payer. Solana dedupes them. Re-signing alone does *not* execute twice.
2. Rebuilding takes a fresh blockhash, which changes the message and the id — and *that* lands a genuine second execution. There is no bitmap to stop it.

Measurements behind both in [IDEMPOTENCY.md](../../IDEMPOTENCY.md).

> SVM retries only work while the stored blockhash is valid (~60–90s). Past that the transaction is permanently dead — safe, but unretryable — and the example says so explicitly rather than failing obscurely.

Prefer `unified-transfer.ts` for real work — this exists to make each mechanism legible.

---

## Omnibus sweep

`omnibus-sweep.ts` — creates N customer wallets, funds each with test USDC, then sweeps everything into a central omnibus wallet. All gasless, so customer wallets never hold ETH, which is what makes a per-customer wallet model practical.

```bash
pnpm example:omnibus        # 10 customer wallets
pnpm example:omnibus 2      # start small
```

> ⚠️ **Not idempotent.** Uses the default random nonce, so a retry would double-execute. It is a scaling demo, not a payments pattern — don't copy it into anything money-touching.

Cost scales quickly: N wallets means N+1 wallet creations and 2N sponsored transactions. Set `RPC_URL` to a dedicated provider first — the concurrent delegation checks will hit public-endpoint rate limits.

Excluded from `pnpm smoke` for that reason; run it directly.
