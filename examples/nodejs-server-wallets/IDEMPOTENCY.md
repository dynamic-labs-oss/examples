# Idempotent Sponsored Transactions

How to retry a gas-sponsored transaction without executing it twice, on EVM and SVM.

Everything here was measured against `@dynamic-labs-wallet/*` **1.0.107** on Base Sepolia and Solana devnet, and re-checked on **1.0.113**. Runnable example: [`src/examples/idempotency/`](src/examples/idempotency) (`pnpm example:idempotency`, `--chain svm` for the Solana mechanism).

---

## The problem

`sendSponsoredTransaction` generates a **fresh random intent nonce** whenever you don't supply one:

```js
const nonce = providedNonce != null ? providedNonce : await generateIntentNonce({...});
// generateIntentNonce -> BigInt('0x' + randomBytes(32).toString('hex'))
```

So two calls describing the same logical operation are two **different** intents, and **both can land on-chain**. Any retry loop around the default path can double-spend.

### The specific trap

`waitForSponsoredTransaction` throws after 60 seconds. **A timeout is not a failure** — the relayer may still land the transaction. Retrying on that throw is the most likely route to double execution in practice.

---

## EVM: the nonce is the idempotency key

### The nonce is an unordered bitmap, not a counter

This is what makes the whole approach viable. The delegate contract exposes `isNonceUsed(uint256) → bool` — set membership, not a sequence check. Measured on a live wallet:

```
consumed nonce (77 digits)   isNonceUsed -> true
  nonce - 1                  isNonceUsed -> false     ← a counter would have these spent
  nonce + 1                  isNonceUsed -> false
values 0, 1, 2, 3            isNonceUsed -> false     ← a counter would burn these first
```

Don't confuse it with the **EOA transaction nonce**, which *is* sequential:

| | Sequential? | Used for |
| --- | --- | --- |
| EOA transaction nonce | **Yes** | The one-time EIP-7702 authorization |
| Intent nonce (`nonce` param) | **No** — bitmap | Every sponsored transaction |

On a wallet that had executed several sponsored intents, the EOA transaction count was still `1` — that single delegation. The relayer is the transaction sender; the wallet only signs an intent.

Because it's a bitmap, intents are order-independent, can be concurrent without head-of-line blocking, and the nonce can be derived statelessly by any worker — no shared counter, no locking.

### Layer 1: derive the nonce from your business key

```ts
import { keccak256, toHex } from "viem";

export function deriveIdempotencyNonce(key: string): bigint {
  return BigInt(keccak256(toHex(key)));   // uniform 256-bit, exactly the nonce width
}

await evmClient.sendSponsoredTransaction({
  walletMetadata,
  externalServerKeyShares,
  calls,
  chainId,
  rpcUrl,
  nonce: deriveIdempotencyNonce(`order:${orderId}`),
});
```

Every retry of that operation produces the same nonce, so the chain admits at most one. **This survives re-signing**, which matters because intents expire after 10 minutes (`validForSeconds`) and a long retry window forces a re-sign — a re-sign without a fixed nonce silently loses the guarantee.

Note: an explicitly passed nonce is **used as-is with no on-chain validation**. Reusing a spent one fails on-chain, which is the safety you want — but treat "failed: nonce already used" as *already executed*, not as a failure to retry.

### Layer 2: persist the `requestId` and ask before retrying

```ts
const { requestId } = await evmClient.relaySponsoredTransaction({ ..., nonce });
await db.save(orderId, requestId);        // persist BEFORE you start waiting

// on retry:
const { status, transactionHash } = await evmClient.getEVMSponsoredTransactionStatus({ requestId });
```

`requestId` — not the transaction hash — is the stable identifier, because the relay may resubmit and change the hash.

Split relay from wait so the `requestId` is stored before waiting. Crashing between relay and write leaves an in-flight transaction you have no record of, which is exactly the window this closes.

**Keep a settled record immutable.** Once an operation has succeeded, no later attempt may overwrite or downgrade that fact. Losing it is worse than never storing it: the next run sees a failed or in-flight record and re-dispatches work already done.

### Why both layers

Layer 2 is the fast path — it avoids spending a relay at all and distinguishes "timed out but succeeded" from "genuinely failed". Layer 1 is the backstop for when layer 2 is unavailable: crash before the write, lost cache, two workers racing.

Demonstrated: bypassing layer 2 and relaying a second intent under the same nonce is rejected with `SMART_CONTRACT_EXECUTION_FAILED`, and the balance does not move.

### `waitForSponsoredTransaction` does not mean confirmed

It resolves as soon as a hash exists, which happens at relay status **`submitted`** — before mining. Measured: resolved at 5013ms with status `submitted`, and the relay still reported `submitted` after the transaction had mined.

(Dynamic's docs state it "resolves on `success`". Measured against 1.0.107, it does not.)

Consequences:

- Reading contract state straight afterwards can observe **pre-transaction values**.
- The relay reports **delivery, not execution** — it won't tell you the calls reverted.

Always confirm the receipt before trusting state or declaring the operation done:

```ts
const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
const succeeded = receipt.status === "success";
```

---

## SVM: the signed bytes are the idempotency key

Different mechanism, and **the rule inverts.** There is no delegate contract and no intent nonce — Dynamic sponsors by replacing the fee payer.

### MPC Ed25519 signing is not deterministic

Plain Ed25519 is deterministic, so it's natural to assume re-signing the same message reproduces the same signature. **It does not here.** Threshold MPC uses fresh per-party randomness:

```
signature A: 4Gw1RKYCA8SPQ6TGpDD3R4XT...
signature B: 35s2dhF9T5ZcePkZkHAjUXXM...     ← same message, signed twice
```

### But under sponsorship, that is not the double-spend vector

It is tempting to conclude "two valid signatures = two executable transactions". **Measured on devnet, that is wrong for sponsored transactions.**

A Solana transaction's id is `signatures[0]` — the **fee payer's** signature. Sponsorship makes Dynamic's sponsor the fee payer, so the wallet's MPC signature sits at `signatures[1]` and does not determine the id:

```
required signers    [7kEydiJ9…(sponsor), 2XYYnbwg…(wallet)]   ← [0] is the sponsor
wallet sig A        48xh7827ZdzrZBiAFaFT8V3h…
wallet sig B        h4u5d1LjT71LfY1Rjqum4169…     ← different, as expected
transaction id      04fc98dc…9b05                 ← identical for A and B
broadcast A     ->  6nPiYJNGQdTJ7ZtSi9zt7znu…
broadcast B     ->  6nPiYJNGQdTJ7ZtSi9zt7znu…     ← same id: deduped, ONE execution
```

Re-sponsoring the *same* built transaction is also fully deterministic — same fee payer, same message bytes, same sponsor signature, same id.

So the real vector is **rebuilding**. A fresh build takes a fresh blockhash, which changes the message, hence the sponsor's signature, hence the id:

```
first execution   fKEocRyTnYYrXdcvx3uCUsM9…
after rebuild     64whF1Yke7Qt3XVnZE2U8tJi…     ← two ids, two executions
```

Two caveats:

- This rests on Dynamic using a **stable sponsor account**. If it rotated between calls the message would change, and with it the id.
- It **inverts on the non-sponsored path** (`pnpm svm:send-txn standard`), where the wallet *is* the fee payer. There `signatures[0]` is the MPC signature, and re-signing alone is enough to double-execute.

The safe rule is unchanged either way — sign once, persist the bytes, rebroadcast verbatim, never rebuild — but "re-signing double-spends" is the wrong reason to follow it when sponsored.

### Solana dedups identical bytes

```
first broadcast  : 5Dr5aRva18m1E7w96WLKcaHr...
second broadcast : 5Dr5aRva18m1E7w96WLKcaHr...     ← same signature, no second execution
```

So the safe pattern is: **sign once, persist the serialized bytes, rebroadcast those bytes on retry. Never rebuild.**

```ts
// once
const signed = attachSignature({ transaction: sponsored, signatureBase58, senderAddress });
const bytes = signed.serialize();
await db.save(orderId, Buffer.from(bytes).toString("base64"));

// retry: rebroadcast the exact same bytes
await connection.sendRawTransaction(bytes);
```

### Ask the chain before rebroadcasting

The rebroadcast above is the fallback, not the first move. If you recorded the signature, query it first — the SVM analogue of polling an EVM `requestId`:

```ts
const { value } = await connection.getSignatureStatus(signature, {
  searchTransactionHistory: true,
});
// value === null  -> no record: never landed, or aged out of history
// value.err       -> landed and failed
// otherwise       -> landed and succeeded: stop, you are done
```

Two reasons this ordering matters:

- It costs nothing and settles the common case ("did my retry already succeed?") without broadcasting.
- **It keeps working after the blockhash expires**, which the rebroadcast does not. Rebroadcasting first means a retry of a *successful* operation fails with `Blockhash not found` — alarming, and easy to misread as "not executed".

Treat `null` as "not confirmed", never as "safe to re-sign".

### The window, and the gap

Blockhash validity is roughly 60–90 seconds. Past that the transaction is **permanently dead** — safe, but unretryable. A retry beyond that window must rebuild and re-sign, which reintroduces the double-execution risk.

Solana's answer is a **durable nonce account**, giving EVM-like semantics: valid indefinitely until the nonce advances, after which the old transaction can never execute.

> ⚠️ **Untested:** whether Dynamic's sponsorship works with durable nonces. Sponsorship rewrites the fee payer, and a durable-nonce transaction requires `AdvanceNonceAccount` as its first instruction, so the two may interact badly. Verify before relying on it.

Beyond the blockhash window, idempotency must come from your own application guard — check business state before re-dispatching — not from the chain.

---

## Side by side

| | EVM | SVM |
| --- | --- | --- |
| Idempotency key | The **nonce**, inside the signed intent | The **signed bytes** |
| Derivable from a business key | ✅ yes (`keccak256(orderId)`) | ❌ no |
| Re-signing on retry | ✅ safe, if the nonce is pinned | ⚠️ deduped when sponsored; **rebuilding** is what double-executes |
| Enforced by | Delegate contract bitmap | Solana signature dedup |
| Validity window | 10 min, re-signable | ~60–90s, not re-signable |
| Retry unit | Re-relay the intent | Rebroadcast exact bytes |
| Stable tracking id | `requestId` | Transaction signature |
| Confirmation source | Receipt (not relay status) | `getSignatureStatus` / receipt |

---

## The unified layer: one call, either chain

Everything above is the *why*. In practice you shouldn't have to hold two mental models — [`src/lib/transfer/index.ts`](src/lib/transfer/index.ts) presents one call shape and picks the right mechanism underneath:

```ts
const result = await sendGaslessTransfer({
  idempotencyKey: `order:${orderId}`,
  chain: "evm",                          // or "svm" — identical shape
  signer: { kind: "server", walletMetadata, externalServerKeyShares },
  clients: { evmClient },
  from, to,
  amount: "1.5",                         // decimal string in whole units
  asset: { kind: "native" },             // or { kind: "token", address, decimals }
});

result.executed; // false when this key had already been dispatched
```

Same inputs for native and token transfers, server and delegated signers, EVM and SVM. Internally:

- **EVM** → derives the bitmap nonce from `idempotencyKey`; nothing needs persisting for correctness.
- **SVM** → signs once, persists the bytes, and rebroadcasts those verbatim on retry.

Runnable as `pnpm example:transfer` ([`src/examples/unified-transfer.ts`](src/examples/unified-transfer.ts)):

```bash
# native, either chain — same flags
pnpm example:transfer --chain evm --to 0xRecipient --amount 0.0001 --idempotency-key order-1
pnpm example:transfer --chain svm --to <base58>    --amount 0.001  --idempotency-key order-2

# token (ERC-20 or SPL)
pnpm example:transfer --chain evm --to 0xRecipient --amount 5 \
  --token 0x678d798938bd326d76e5db814457841d055560d0 --decimals 6 --idempotency-key order-3

# delegated wallet rather than a server wallet
pnpm example:transfer --chain evm --delegated --to 0xRecipient --amount 0.0001 --idempotency-key order-4
```

### Deliberate constraints

- **Fungible transfers only** — native, ERC-20, SPL. No arbitrary contract calls; use the chain-specific helpers for those.
- **`--decimals` is optional and never guessed.** Omitted, it is read from the token contract / mint. Supplied, it is *verified* against the chain and a mismatch refuses the transfer — wrong decimals would misvalue by orders of magnitude.
- **Amounts are decimal strings**, converted with `parseUnits`. No floats anywhere near a balance.
- **SPL transfers require the recipient's ATA to already exist.** Sponsorship covers fees, not account rent — and the sponsor's address isn't even known until sponsorship runs, so it can't be named as the rent payer at build time. The layer fails with an actionable error rather than emitting a transaction that reverts.

---

## Status of the examples in this repo

| Example | Idempotent? |
| --- | --- |
| `src/examples/unified-transfer.ts` | ✅ always — both chains, via the unified layer |
| `src/examples/idempotency/` | ✅ always — EVM (both layers) and SVM (signed-bytes replay) |
| `src/evm/send-transaction.ts` | ⚙️ opt-in — pass `--order-id` |
| `src/svm/send-transaction.ts` | ⚙️ opt-in — pass `--order-id` |
| `src/examples/omnibus-sweep.ts` | ❌ default random nonce — demo only |

### One behavioural difference to expect

The **nonce layer alone fails loudly**; the **store layer fails gracefully**.

With only a derived nonce (`--order-id` on `evm:send-txn`), an EVM retry of an already-executed operation throws `SMART_CONTRACT_EXECUTION_FAILED` — the nonce is spent, so the chain rejects it. That is *safe* (nothing executes twice) but not friendly: you cannot tell "already done" from "genuinely broken" without inspecting further.

Adding the persisted record — as `unified-transfer.ts` and `idempotency/` do — turns that into a clean no-op that returns the original transaction id. Verified: an EVM retry short-circuits in 0.00s, and an SVM retry returns the identical signature in 0.80s without re-signing.

So treat "nonce already used" as *already executed*, and prefer the store layer wherever you want a usable answer rather than just a safe one.
