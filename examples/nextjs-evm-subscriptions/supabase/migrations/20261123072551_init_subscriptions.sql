-- EVM subscriptions: a subscription is a set of pre-signed EIP-3009
-- authorizations, one per billing period. Run this in the Supabase SQL editor.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber text not null,
  merchant text not null,
  chain_id integer not null,
  token_address text not null,
  amount text not null,
  period_seconds integer not null,
  pulls_total integer not null,
  status text not null default 'active' check (status in ('active', 'cancelled', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.authorizations (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  period_index integer not null,
  from_address text not null,
  to_address text not null,
  value text not null,
  valid_after bigint not null,
  valid_before bigint not null,
  nonce text not null,
  signature text not null,
  status text not null default 'pending'
    check (status in ('pending', 'posting', 'posted', 'failed', 'cancelled')),
  tx_hash text,
  error text,
  posted_at timestamptz,
  executor text not null default 'direct' check (executor in ('direct', 'relay')),
  relay jsonb,
  created_at timestamptz not null default now(),
  unique (subscription_id, nonce)
);

create index if not exists authorizations_due_idx
  on public.authorizations (status, valid_after)
  where status = 'pending';

create index if not exists subscriptions_subscriber_idx
  on public.subscriptions (subscriber);

-- Lock both tables down. The app only talks to Postgres from the server with
-- the secret key (which bypasses RLS). With RLS enabled and no policies, the
-- publishable/anon key can neither read nor write these rows, so the stored
-- signed authorizations are not exposed through the public Data API.
alter table public.subscriptions enable row level security;
alter table public.authorizations enable row level security;
