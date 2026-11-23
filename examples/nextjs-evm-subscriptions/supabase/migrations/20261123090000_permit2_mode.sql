-- Permit2 subscriptions: one signed PermitSingle allowance to a cadence-
-- enforcing SubscriptionPlan contract, instead of N pre-signed EIP-3009 auths.

alter table public.subscriptions
  add column if not exists mode text not null default 'eip3009'
    check (mode in ('eip3009', 'permit2')),
  add column if not exists plan_contract text;

-- Permit2 pulls are executed by calling plan.pull(subscriber); the rows in
-- public.authorizations just schedule/track them (signature stays empty).
alter table public.authorizations
  drop constraint if exists authorizations_executor_check;
alter table public.authorizations
  add constraint authorizations_executor_check
    check (executor in ('direct', 'relay', 'permit2'));
