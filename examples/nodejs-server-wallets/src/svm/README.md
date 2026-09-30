# Solana Server Wallet Examples

Single-operation examples for Solana server wallets — wallets your application owns and holds key shares for. For wallets a *user* has delegated to you, see [`delegated/`](delegated).

Default cluster is devnet (`SOLANA_RPC_URL`, `SOLANA_CLUSTER`).

| Example | Command |
| --- | --- |
| [Wallet management](#wallet-management) | `pnpm svm:wallet` |
| [Send transaction](#send-transaction) | `pnpm svm:send-txn` |
| [Sign message](#sign-message) | `pnpm svm:sign-msg` |

---

## How Solana sponsorship differs from EVM

Worth reading before the examples — it is not the EVM model with different names.

| | EVM | SVM |
| --- | --- | --- |
| Mechanism | EIP-7702 delegation + signed intent | **Fee payer replacement** |
| One-time setup | 7702 authorization per wallet | None |
| Who broadcasts | Dynamic's relayer | **Your server** |
| Signatures | ECDSA (hex) | Ed25519 (base58) |

Dynamic swaps the transaction's fee payer for its own sponsor account and signs as that payer; your server then adds the wallet's signature and submits it. Because replacing the fee payer changes the message being signed, **sponsorship must happen before signing**.

Two consequences that bite in practice:

- Transactions are built as **v0 `VersionedTransaction`**, because Dynamic's sponsorship endpoint always returns versioned — building v0 keeps the type stable end to end. (Legacy `Transaction` inputs also work as of SDK 1.0.107; on 1.0.101 and earlier they threw.)
- Blockhashes are fetched at **`finalized`**, not `confirmed`. Sponsorship plus MPC signing adds round trips, and public RPC is load-balanced, so a just-confirmed blockhash may be unknown to whichever node simulates the transaction.

---

## Wallet management

`wallet.ts` — create, list, and delete Solana server wallets.

```bash
pnpm svm:wallet --create                                    # ephemeral, not saved
pnpm svm:wallet --create --save                              # persist for reuse
pnpm svm:wallet --create --save --threshold 3                # 2-of-3 instead of 2-of-2
pnpm svm:wallet --create --save --backup --password secret   # shares backed up to Dynamic
pnpm svm:wallet --list                                       # also shows SOL balance
pnpm svm:wallet --delete <base58-address>
```

Flags match the EVM script; `--backup` likewise requires `--password`. `--list` filters to SVM wallets and includes each balance, which is the first thing you want when a `standard` send fails.

---

## Send transaction

`send-transaction.ts` — a 0-lamport self-transfer, either paying the fee or having Dynamic sponsor it.

```bash
pnpm svm:send-txn standard                              # wallet pays the fee
pnpm svm:send-txn gasless                               # Dynamic sponsors
pnpm svm:send-txn gasless --address <base58>
pnpm svm:send-txn gasless --order-id order-1            # idempotent: safe to retry
```

| Mode | Needs |
| --- | --- |
| `standard` | Devnet SOL in the wallet |
| `gasless` | Gas sponsorship enabled for your environment |

A 0-lamport self-transfer moves nothing but still requires the wallet's signature, which is exactly what demonstrates who paid the fee. Verified on devnet: a wallet holding **zero SOL** transacted successfully while Dynamic's sponsor paid 10,000 lamports.

### `--order-id` works differently here

On EVM you pin a nonce. There is no nonce on Solana, and **rebuilding takes a fresh blockhash** — a new message, so a new transaction id, so a second execution. (Re-signing alone is deduped when sponsored, because the id is the sponsor's signature; see [IDEMPOTENCY.md](../../IDEMPOTENCY.md).) So the safe unit is the signed bytes:

1. Sign once, persist the serialized bytes.
2. On retry, rebroadcast **those exact bytes**. Solana dedups identical signatures, so it cannot execute twice.
3. Never rebuild — a fresh blockhash means a new transaction id.

The retry window is bounded by blockhash validity (~60–90s); past that the transaction is permanently dead and a retry must rebuild, which needs an application-level guard. See [IDEMPOTENCY.md](../../IDEMPOTENCY.md).

---


## Funding a wallet (only for value transfers)

Sponsorship pays the **network fee**, not the **amount you send**. Those are separate
costs, and only the first is covered:

| Cost | Paid by |
| --- | --- |
| Transaction fee (the fee payer's lamports) | Dynamic's sponsor |
| The SOL or SPL tokens actually transferred | The wallet itself |

So a 0-balance wallet can send a **0-lamport** transaction all day — which is exactly
what `svm:send-txn` and `pnpm example:idempotency --chain svm` do, since their point
is to show who pays the fee. But moving real value needs real balance, so
`pnpm example:transfer --chain svm` fails on an unfunded wallet.

To fund one on devnet:

```bash
solana airdrop 0.05 <address> --url devnet
```

If you don't have the Solana CLI, or that returns `Internal error` (the RPC faucet is
heavily rate-limited and frequently down), use the web faucet at
[faucet.solana.com](https://faucet.solana.com) instead — it is noticeably more
reliable. 0.05 SOL is plenty; transfer amounts here can be fractions of a cent.

`pnpm svm:wallet --list` shows each saved wallet's balance.

## Transfer token

`transfer-token.ts` — moves an SPL balance with `TransferChecked`. Defaults to a 0-amount self-transfer of devnet USDC.

```bash
pnpm svm:transfer-token                                 # 0 USDC to self, wallet pays the fee
pnpm svm:transfer-token --to <base58> --amount 1.5
pnpm svm:transfer-token --mint <mint> --amount 10       # --token also accepted
pnpm svm:transfer-token --sponsored                     # Dynamic pays the fee
```

### Balances live in a separate account

A Solana token balance isn't held by the wallet. Each (owner, mint) pair gets its own **associated token account** (ATA) at a derived address, so a transfer moves value between two ATAs while the wallet signs as owner.

Both ATAs must already exist. Creating one costs rent, which fee sponsorship does not cover — and under sponsorship the payer isn't known until sponsorship runs, so it can't be named as rent payer at build time. A missing ATA is therefore a clear error rather than something this script creates:

- **Sender has none** → the wallet holds none of that token. Receiving a transfer creates it.
- **Recipient has none** → they need to create it, or you fund its rent separately.

To create one yourself so this script can run, any funded payer will do:

```bash
spl-token create-account <mint> --owner <wallet address> --url devnet
```

The account only has to *exist* — a 0-amount transfer from an empty one is valid, so
you don't need to acquire the token just to try the script. Rent is about 0.002 SOL.

This is the main thing that differs from the EVM script, where a balance is just a number in the contract's storage and no extra account exists.

### Why `TransferChecked`

It carries the expected decimals and the token program rejects the instruction if they disagree with the mint — so a stale decimals value fails loudly instead of moving the wrong amount by a factor of ten. Decimals are read from the mint account.

Unlike the EVM default (a test token with an open `mint`), devnet USDC can't be minted on demand, so any non-zero amount means acquiring some first.

## Sign message

`sign-message.ts` — Ed25519 signing, returned base58-encoded (the Solana convention, unlike hex on EVM). Off-chain, no sponsorship needed.

```bash
pnpm svm:sign-msg "Hello, World!"
pnpm svm:sign-msg "Hello, World!" --address <base58>
pnpm svm:sign-msg "Hello, World!" --address <base58> --password secret
```

There is no SVM equivalent of `sign-typed-data` — EIP-712 is EVM-specific.
