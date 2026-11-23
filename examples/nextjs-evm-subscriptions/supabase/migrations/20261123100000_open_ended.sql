-- Open-ended ("until cancelled") Permit2 subscriptions have no fixed pull
-- count: pulls_total is NULL and the collector appends one schedule row per
-- period instead of creating them all up front.

alter table public.subscriptions
  alter column pulls_total drop not null;
