# Earn Automation

Auto-deposit a wallet's assets into a Dynamic Earn yield vault — **sweep everything** or a **fixed amount** — on a schedule, using only existing Dynamic tools:

- **Frontend (Next.js):** Dynamic login → pick wallet → pick vault → sweep-all or fixed amount → delegate signing once → manage rules.
- **Backend (serverless API routes):** user-scoped rule CRUD, a cron sweep executor, and Dynamic webhook receivers.
- **Persistence:** Supabase (optional) or a local `.data/db.json` file — no external services needed to run locally.

No redcoast or SDK changes are required; this is exactly what a customer could ship today.

## How it works

```
User (browser)                      App server                         Dynamic / chain
──────────────                      ──────────                         ────────────────
login ────────────────────────────▶ verify JWT (JWKS)
pick wallet+vault+mode
initDelegationProcess() ──────────▶                                  one-time delegation consent
                                    ◀── wallet.delegation.created webhook (HMAC-verified,
                                        encrypted share + walletApiKey) → AES-256-GCM at rest
POST /api/rules ──────────────────▶ rules row
                                    POST /api/cron/sweep (CRON_SECRET) or /api/webhooks/deposit
                                    → balance via viem → yieldVaultDeposit quote
                                    → delegatedSendSponsoredTransaction (sponsored)
                                      or delegatedSignTransaction + sendRawTransaction
                                    → runs row {txHash | skipReason}
revoke in Dynamic dashboard ──────▶ wallet.delegation.revoked → delegation deleted,
                                        wallet's rules paused
```

### Why delegation, not custody?

The app never holds the user's keys. `initDelegationProcess()` creates a **delegated share set** scoped to that wallet; the server can only sign via `delegated*` APIs, and the user can revoke the share set at any time — revocation webhook immediately deletes the stored material and pauses the wallet's rules. Delegation material is additionally AES-256-GCM encrypted at rest (`ENCRYPTION_KEY`).

> Production hardening note: server-side delegation can sign *any* transaction the delegated path supports. A production version should add a signer **policy layer** (allowlist chain, vault contract, deposit/approve calldata, amount cap) enforced in the enclave — that piece lives in redcoast.

## Running locally

```bash
pnpm install
cp .env.example .env.local   # fill in values below
pnpm dev                     # http://localhost:3000
```

Required env vars:

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_DYNAMIC_ENV_ID` | Dynamic environment id |
| `DYNAMIC_API_TOKEN` | Server-side API token (yield quote calls) |
| `ENCRYPTION_KEY` | AES-256 key for stored delegation material |
| `CRON_SECRET` | Bearer secret for `/api/cron/sweep` + `/api/webhooks/deposit` |
| `RPC_URL_<chainId>` / `RPC_URL_DEFAULT` | Optional RPC overrides (Base defaults to `mainnet.base.org`) |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Optional; run `supabase/schema.sql` first. Unset = local JSON store |

### Delegation without a tunnel

The `wallet.delegation.created` webhook needs Dynamic to reach your server. For pure local dev, `POST /api/delegations` lets the client seed a delegation grant directly (same storage, minus webhook transport encryption). Point a webhook at `/api/webhooks/dynamic` (set `DYNAMIC_WEBHOOK_SECRET` and `DYNAMIC_DELEGATION_PRIVATE_KEY`) when running behind a tunnel/deploy.

### Triggering sweeps

```bash
# Everything due
curl -X POST localhost:3000/api/cron/sweep \
  -H "Authorization: Bearer $CRON_SECRET" -H 'Content-Type: application/json' -d '{}'

# One rule
curl -X POST localhost:3000/api/cron/sweep \
  -H "Authorization: Bearer $CRON_SECRET" -H 'Content-Type: application/json' \
  -d '{"ruleId":"<id>"}'

# Webhook-style: sweep rules matching a wallet (e.g. fed by a balance-change notifier)
curl -X POST localhost:3000/api/webhooks/deposit \
  -H "Authorization: Bearer $CRON_SECRET" -H 'Content-Type: application/json' \
  -d '{"address":"0x…","assetAddress":"0x…"}'
```

The UI also has a **Run now** button per rule (`POST /api/rules/:id/run`).

## Behavior notes

- **Sweep mode** reads the on-chain balance of the vault's asset. For the native gas token it leaves `gasReserve` (default `0.005`) behind.
- **Fixed mode** skips (and logs why) when the wallet balance is below the configured amount.
- ERC-20 approval is handled automatically — the quote returns `evmApproval` when needed; sponsored runs batch approve+deposit, unsponsored runs send approve first.
- Every execution writes a `runs` row with `deposited | skipped | failed` plus tx hash or reason.
