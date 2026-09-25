-- ATLAS Master Evidence Registry v1
-- Append-only, tenant-scoped evidence ledger for release, module and governance claims.
-- Evidence is superseded by a newer record rather than rewritten in place.

create table if not exists public.atlas_master_evidence_registry (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  release_id uuid references public.atlas_releases(id) on delete set null,
  deployment_id uuid references public.atlas_deployments(id) on delete set null,
  module text,
  claim text not null check (length(btrim(claim)) between 3 and 2000),
  source_type text not null check (source_type in (
    'machine_verification',
    'production_standard',
    'operational_snapshot',
    'module_audit',
    'product_blueprint',
    'runbook',
    'historical_baseline',
    'personal_document',
    'symbolic_content'
  )),
  evidence_level text not null check (evidence_level in ('P0','P1','P2','PERSONAL','SYMBOLIC')),
  status text not null check (status in (
    'VIGENTE',
    'IMPLEMENTADA',
    'PENDIENTE',
    'SUPERADA',
    'REQUIERE_REVERIFICACION'
  )),
  environment text not null default 'reference' check (environment in (
    'development','staging','production','reference','personal'
  )),
  expected_sha text check (expected_sha is null or expected_sha ~ '^[0-9a-f]{40}$'),
  deployed_sha text check (deployed_sha is null or deployed_sha ~ '^[0-9a-f]{40}$'),
  verified_at timestamptz,
  source_ref text not null check (length(btrim(source_ref)) between 3 and 1000),
  supersedes_id uuid references public.atlas_master_evidence_registry(id) on delete restrict,
  production_impact text not null default 'informational' check (
    production_impact in ('blocking','gating','informational','none')
  ),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=12000
  ),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.atlas_master_evidence_registry enable row level security;

drop policy if exists atlas_master_evidence_registry_read
  on public.atlas_master_evidence_registry;
create policy atlas_master_evidence_registry_read
on public.atlas_master_evidence_registry
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.org_id = atlas_master_evidence_registry.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
  and public.has_identity_permission(org_id, 'releases.read')
);

create index if not exists idx_atlas_master_evidence_org_created
  on public.atlas_master_evidence_registry(org_id, created_at desc);
create index if not exists idx_atlas_master_evidence_module_status
  on public.atlas_master_evidence_registry(org_id, module, status, created_at desc);
create index if not exists idx_atlas_master_evidence_release
  on public.atlas_master_evidence_registry(release_id, deployment_id);
create index if not exists idx_atlas_master_evidence_supersedes
  on public.atlas_master_evidence_registry(supersedes_id)
  where supersedes_id is not null;

create or replace function public.atlas_master_evidence_reject_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  raise exception 'atlas_master_evidence_registry is append-only; supersede with a new evidence record';
end;
$$;

drop trigger if exists atlas_master_evidence_immutable
  on public.atlas_master_evidence_registry;
create trigger atlas_master_evidence_immutable
before update or delete on public.atlas_master_evidence_registry
for each row execute function public.atlas_master_evidence_reject_mutation();

revoke all on table public.atlas_master_evidence_registry from anon;
revoke insert, update, delete on table public.atlas_master_evidence_registry from authenticated;
grant select on table public.atlas_master_evidence_registry to authenticated;

comment on table public.atlas_master_evidence_registry is
'Append-only ATLAS Master Evidence Registry. Current truth is derived from precedence, exact release/SHA evidence and supersession, never by rewriting historical records.';
