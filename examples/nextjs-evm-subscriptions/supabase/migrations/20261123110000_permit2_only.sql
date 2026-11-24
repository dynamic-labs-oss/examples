-- Permit2-only cleanup: the EIP-3009 / Relay modes are removed.

-- 1. Retire any EIP-3009 subscriptions and pulls that are still open. History
--    (posted pulls and their tx hashes) is kept.
update public.authorizations
   set status = 'cancelled', error = 'EIP-3009 mode removed'
 where executor <> 'permit2'
   and status in ('pending', 'posting');

update public.subscriptions
   set status = 'cancelled'
 where mode <> 'permit2'
   and status = 'active';

-- 2. Drop the columns only those modes used. This also discards any stored
--    pre-signed authorizations (signatures), which are no longer needed.
alter table public.authorizations
  drop column if exists signature,
  drop column if exists relay,
  drop column if exists executor;

alter table public.subscriptions
  drop column if exists mode;

-- 3. When a pull was claimed by a collector run. A function that dies
--    mid-pull (serverless timeout) leaves its row in 'posting'; rows claimed
--    long ago are put back to 'pending' on the next run.
alter table public.authorizations
  add column if not exists claimed_at timestamptz;
