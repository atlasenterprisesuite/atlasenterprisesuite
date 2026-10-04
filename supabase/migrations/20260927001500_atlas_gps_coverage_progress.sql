-- Persist ATLAS GPS 4D coverage progress so street/sector sweeps can resume safely.
-- State is scoped to the active organization and user and never implies imagery verification.

create table if not exists public.atlas_gps_coverage_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  coverage_key text not null check (char_length(btrim(coverage_key)) between 1 and 160),
  label text not null check (char_length(btrim(label)) between 1 and 240),
  scope text not null check (scope in ('street', 'sector', 'city', 'region', 'country', 'continent', 'globe')),
  status text not null default 'pending'
    check (status in ('pending', 'in-progress', 'complete', 'blocked')),
  state jsonb not null default '{}'::jsonb,
  progress_pct numeric(5,2) not null default 0 check (progress_pct between 0 and 100),
  last_probe_id text,
  last_sector_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, user_id, coverage_key)
);

create index if not exists atlas_gps_coverage_runs_org_user_idx
  on public.atlas_gps_coverage_runs(org_id, user_id, updated_at desc);

alter table public.atlas_gps_coverage_runs enable row level security;

drop policy if exists atlas_gps_coverage_runs_read on public.atlas_gps_coverage_runs;
create policy atlas_gps_coverage_runs_read
on public.atlas_gps_coverage_runs
for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members om
    where om.org_id = atlas_gps_coverage_runs.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists atlas_gps_coverage_runs_insert on public.atlas_gps_coverage_runs;
create policy atlas_gps_coverage_runs_insert
on public.atlas_gps_coverage_runs
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members om
    where om.org_id = atlas_gps_coverage_runs.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists atlas_gps_coverage_runs_update on public.atlas_gps_coverage_runs;
create policy atlas_gps_coverage_runs_update
on public.atlas_gps_coverage_runs
for update to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members om
    where om.org_id = atlas_gps_coverage_runs.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members om
    where om.org_id = atlas_gps_coverage_runs.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists atlas_gps_coverage_runs_delete on public.atlas_gps_coverage_runs;
create policy atlas_gps_coverage_runs_delete
on public.atlas_gps_coverage_runs
for delete to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members om
    where om.org_id = atlas_gps_coverage_runs.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

grant select, insert, update, delete on public.atlas_gps_coverage_runs to authenticated;
revoke all on public.atlas_gps_coverage_runs from anon;
