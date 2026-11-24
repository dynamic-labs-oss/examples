-- Support both EVM modes side by side:
--   permit2 : one Permit2 allowance to a cadence-enforcing plan contract
--   eip3009 : one pre-signed transferWithAuthorization per period, executed
--             by our relayer key ("direct") or by Relay ("relay")
--
-- Additive and backward compatible: existing rows are Permit2 rows.

alter table public.subscriptions
  add column if not exists mode text not null default 'permit2'
    check (mode in ('permit2', 'eip3009'));

-- Only EIP-3009 rows carry a signature; Permit2 rows are authorized by the
-- single on-chain allowance instead. The signature is a bearer authorization,
-- so it is never returned by the API (see GET /api/subscriptions).
alter table public.authorizations
  add column if not exists signature text,
  add column if not exists executor text not null default 'permit2'
    check (executor in ('permit2', 'direct', 'relay')),
  add column if not exists relay jsonb;
