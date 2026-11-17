-- ATLAS Robotics F4: isolated schema contract, NOT approved for production migration.
-- No API grants; server authorization and transaction orchestration are still required.
create table if not exists public.atlas_robotics_simulation_runs (
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id text not null check (run_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  status text not null check (status in ('reserved','completed','halted','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, org_id, run_id)
);
alter table public.atlas_robotics_simulation_runs enable row level security;
alter table public.atlas_robotics_simulation_runs force row level security;
revoke all on public.atlas_robotics_simulation_runs from public, anon, authenticated;
-- No RLS policies intentionally: all ordinary roles fail closed.
-- Trusted server-side transaction must authenticate caller, lock membership and
-- serialize authorization + reservation + completion using a single DB transaction.
-- Do NOT enable service_role access until that contract has negative PG tests.
