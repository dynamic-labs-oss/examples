-- Short, stable account code per delegation — the user↔wallet handle the agent
-- resolves against (so the agent is never given a hardcoded address). Derived
-- deterministically from the wallet address in the app layer.

alter table public.delegations add column if not exists code text;

create unique index if not exists delegations_code_idx on public.delegations (code);
