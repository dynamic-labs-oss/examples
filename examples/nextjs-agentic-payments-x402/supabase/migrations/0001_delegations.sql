-- Delegated wallet credentials, encrypted at rest (AES-256-GCM).
--
-- The application encrypts the delegated key share + wallet API key before
-- insert (see lib/shared/delegation-store.ts), so this table never holds
-- plaintext key material. Access is via the Supabase service-role key from the
-- server / agent only; Row Level Security blocks anon/public access.

create table if not exists public.delegations (
  user_id           text        not null,
  chain             text        not null,
  wallet_id         text        not null,
  address           text        not null,
  -- AES-256-GCM ciphertext of { delegatedShare, walletApiKey } (base64)
  secret_ciphertext text        not null,
  secret_iv         text        not null,
  secret_tag        text        not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, chain)
);

-- The agent looks up delegations by wallet address.
create index if not exists delegations_address_chain_idx
  on public.delegations (address, chain);

-- Lock the table down: only the service role (used server-side) may touch it.
alter table public.delegations enable row level security;
-- No policies are created, so anon/authenticated clients have no access.
-- The service-role key bypasses RLS for server/agent use.
