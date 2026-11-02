-- ATLAS 777 PR #976: additive, fail-closed browser idempotency ledger.
-- This is a schema-only prerequisite. No API role may claim or replay work.
-- Do not deploy before PostgreSQL 17 concurrency and revocation certification.
-- Retain terminal idempotency evidence when org/workflow/step deletion is requested.
-- RESTRICT deliberately blocks parent deletion until a separately audited
-- retention/tombstone migration preserves replay protection; no cascade cleanup.
create table if not exists public.execution_browser_idempotency (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  tenant_id text not null check (length(btrim(tenant_id)) > 0),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 1 and 200),
  workflow_id uuid not null references public.execution_workflows(id) on delete restrict,
  step_id uuid not null references public.execution_steps(id) on delete restrict,
  actor_user_id uuid not null,
  state text not null default 'reserved' check (state in ('reserved','completed','indeterminate','revoked')),
  action_digest text not null check (action_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, tenant_id, idempotency_key)
);
create index if not exists execution_browser_idempotency_actor_idx
  on public.execution_browser_idempotency(org_id,actor_user_id,state);
alter table public.execution_browser_idempotency enable row level security;
alter table public.execution_browser_idempotency force row level security;
revoke all on public.execution_browser_idempotency from public, anon, authenticated;
comment on table public.execution_browser_idempotency is
  'ATLAS Sovereign Browser terminal idempotency ledger. No automatic replay after indeterminate side effects. No API grants or RPC until transactional identity/revocation certification.';
