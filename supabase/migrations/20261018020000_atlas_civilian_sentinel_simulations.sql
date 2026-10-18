-- ATLAS Civilian Sentinel: simulation-only events. No military targeting, jamming, or public dispatch.
create table if not exists public.atlas_civilian_simulations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  scenario text not null check (char_length(scenario) between 3 and 120),
  status text not null default 'DRAFT' check (status in ('DRAFT','SIMULATED','ARCHIVED')),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  simulation_only boolean not null default true check (simulation_only is true),
  created_at timestamptz not null default now()
);
create index if not exists atlas_civilian_simulations_owner_org_created_idx on public.atlas_civilian_simulations(owner_id,org_id,created_at desc);
alter table public.atlas_civilian_simulations enable row level security;
revoke all on public.atlas_civilian_simulations from anon;
grant select, insert on public.atlas_civilian_simulations to authenticated;
create policy atlas_civilian_simulations_owner_read on public.atlas_civilian_simulations
  for select to authenticated using (owner_id = (select auth.uid())
    and exists (select 1 from public.organization_members m where m.organization_id = org_id and m.user_id = (select auth.uid())));
create policy atlas_civilian_simulations_owner_create on public.atlas_civilian_simulations
  for insert to authenticated with check (owner_id = (select auth.uid())
    and status = 'DRAFT' and simulation_only
    and exists (select 1 from public.organization_members m where m.organization_id = org_id and m.user_id = (select auth.uid())));
comment on table public.atlas_civilian_simulations is 'Educational civilian emergency simulation records only; no real incident dispatch.';
