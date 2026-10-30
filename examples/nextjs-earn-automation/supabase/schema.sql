-- Earn automation demo schema.
-- delegation secrets are stored AES-256-GCM encrypted (see lib/crypto.ts);
-- enable RLS or keep the service-role key server-side only.

create table if not exists delegations (
  "userId"       text not null,
  "chain"        text not null,
  "walletId"     text not null,
  "address"      text not null,
  "shareSetId"   text,
  "delegatedShareEnc" text not null,
  "walletApiKeyEnc"   text not null,
  "createdAt"    timestamptz not null default now(),
  primary key ("address", "chain")
);

create table if not exists rules (
  "id"            uuid primary key,
  "userId"        text not null,
  "walletAddress" text not null,
  "walletId"      text not null,
  "vaultId"       text not null,
  "chainId"       integer not null,
  "assetAddress"  text not null,
  "assetSymbol"   text not null,
  "assetDecimals" integer not null,
  "mode"          text not null check ("mode" in ('sweep','fixed')),
  "amount"        text,
  "sponsored"     boolean not null default true,
  "gasReserve"    text not null default '0.005',
  "enabled"       boolean not null default true,
  "createdAt"     timestamptz not null default now(),
  "lastRunAt"     timestamptz
);
create index if not exists rules_user_idx on rules ("userId");
create index if not exists rules_wallet_idx on rules ("walletAddress");

create table if not exists runs (
  "id"        uuid primary key,
  "ruleId"    uuid not null references rules("id") on delete cascade,
  "status"    text not null check ("status" in ('deposited','skipped','failed')),
  "amount"    text,
  "txHash"    text,
  "reason"    text,
  "createdAt" timestamptz not null default now()
);
create index if not exists runs_rule_idx on runs ("ruleId", "createdAt" desc);
