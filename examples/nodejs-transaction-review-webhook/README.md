# Transaction Review webhook — example server

A self-contained Express app that implements Dynamic's [Transaction Review
webhook contract](https://docs.dynamic.xyz/overview/wallets/embedded-wallets/mpc/transaction-review)
end-to-end. Use it to validate the feature locally against your Dynamic sandbox
environment before wiring up your real backend.

What it does:

- Listens on `POST /webhook`.
- Verifies the `x-dynamic-signature` HMAC-SHA256 request header against your
  shared secret. Requests with a missing or wrong signature get a `401` and
  `{ proceed: false, reason: "Invalid signature" }`.
- Optionally signs every response with Ed25519 and sets the
  `x-dynamic-response-signature` header so Dynamic's response verification path
  can be exercised.
- Exposes four hot-switchable decision modes via the `?mode=` query string so
  you can flip behavior without restarting the server:

  | mode    | behavior                                                            |
  | ------- | ------------------------------------------------------------------- |
  | `allow` | `{ proceed: true }`                                                 |
  | `deny`  | `{ proceed: false, reason: "<DENY_REASON>" }`                       |
  | `slow`  | Sleep for `SLOW_MS` ms before responding (exercises failure policy) |
  | `crash` | Tear down the TCP socket without writing a response                 |

  The default mode comes from `MODE` in `.env`. Anything else falls back to
  the default.

## Setup

> Requires Node 18+ and pnpm. Tested on Node 22.

```bash
cd examples/nodejs-transaction-review-webhook
pnpm install
cp .env.example .env
pnpm keygen      # writes private.pem + public.pem, prints the public key
pnpm dev         # starts the server with hot-reload on $PORT (default 4040)
```

`pnpm keygen` will refuse to overwrite existing keys — delete `private.pem`
and `public.pem` first if you really want to rotate.

## Expose it to Dynamic

Dynamic needs to reach your local server, so tunnel it:

```bash
ngrok http 4040
```

Copy the `https://<random>.ngrok-free.app` URL ngrok prints — that's your
**Webhook URL**.

## Configure in the dashboard

In the Dynamic dashboard for your sandbox environment, go to
**Wallets → Transaction Review** and fill in:

| Field                         | Value                                              |
| ----------------------------- | -------------------------------------------------- |
| **Webhook URL**               | `https://<your-tunnel>.ngrok-free.app/webhook`     |
| **Webhook Secret**            | Same string you put in `WEBHOOK_SECRET` in `.env`  |
| **Response Verification Key** | Paste the contents of `public.pem` (printed above) |
| **Failure Policy**            | `DENY` (default) — recommended for testing         |

Save. You're now ready to drive transactions through the SDK.

## Fastest validation — the dashboard "Send test" button

You don't need to drive a real SDK transaction. Once the URL/secret/public
key are in the form, the side panel exposes a **Test webhook** card with a
scenario dropdown (`Sign message`, `EVM transaction`, `EVM token transfer`,
`EVM user operation`, `EVM typed data`, `Solana transaction`) and a **Send
test** button. Clicking it drives a synthetic payload through the same HMAC
signing, Ed25519 verification, timeout, and failure-policy machinery as the
live signing path — but with no events, no DB writes, and no signing
operation involved.

The result panel shows the decision badge (`Approved` / `Denied` / `Failure
policy applied`), latency, HTTP status, signature verification state, and
collapsible request/response bodies. Flip `?mode=allow|deny|slow|crash` in
the **Webhook URL** field and press _Send test_ again to confirm each
scenario without ever leaving the dashboard.

## What to verify with a real signing operation

Trigger any signing operation from the SDK (`signMessage`, EVM tx, Solana tx,
ERC-4337 UserOp — doesn't matter; the webhook fires for all of them). For
each scenario flip the mode and re-trigger:

1. **Default approve** (`MODE=allow` or `?mode=allow`)

   - Webhook logs the incoming request with the `requestId`, `walletId`, `chain`.
   - Signing completes; SDK gets a signature.
   - Event `waas.transaction.review.approved` is published.

2. **Deny with reason** (`?mode=deny`)

   - Webhook responds `{ proceed: false, reason: "Denied by example webhook" }`.
   - SDK surfaces a `TransactionReviewDenied` error whose message contains the
     reason.
   - Event `waas.transaction.review.denied` is published.

3. **Response signing**

   - With `WEBHOOK_PRIVATE_KEY_PATH` set and the matching public key saved in
     the dashboard, Dynamic accepts the response. Try corrupting the public key
     in the dashboard (e.g. change one base64 char) — Dynamic should fall back
     to your failure policy and reject the response signature.

4. **Failure policy** (`?mode=slow` with `SLOW_MS` > the configured timeout)

   - Configured `DENY`: signing is blocked with a transaction-review-unreachable
     error.
   - Re-save the dashboard config with `ALLOW`: signing proceeds despite the
     timeout. Same `?mode=slow` exercises both.

5. **Hard crash** (`?mode=crash`)
   - Webhook tears down the TCP connection. Dynamic treats this like any other
     transport failure and applies the failure policy.

## Sanity check

`GET http://localhost:$PORT/health` is a minimal liveness probe. Your effective
config (mode, whether HMAC verification / response signing are enabled) is
printed to the console on startup — check there to confirm your `.env` was
picked up, rather than exposing it over HTTP.

```bash
curl -s http://localhost:4040/health | jq
# {
#   "status": "ok"
# }
```

## Not production code

This is a reference server. It can log request bodies to stdout (opt-in via
`LOG_BODIES=true`), has no persistence, and doesn't validate payload shapes
beyond what's needed to demonstrate the contract. Use it to verify the wiring;
build your real webhook against the [Transaction Review documentation](https://docs.dynamic.xyz/overview/wallets/embedded-wallets/mpc/transaction-review).
