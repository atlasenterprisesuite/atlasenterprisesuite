-- ATLAS Infrastructure Assurance policies
-- Organization-scoped desired-state requirements only. Provider observations and secrets do not belong here.

create table if not exists public.atlas_infrastructure_assurance_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  environment text not null check (environment in ('staging','production')),
  domain text not null check (length(btrim(domain)) between 2 and 120),
  requirement text not null check (length(btrim(requirement)) between 3 and 240),
  severity text not null check (severity in ('P0','P1','P2')),
  required_status text not null check (required_status in (
    'verified',
    'partially_verified',
    'unverified',
    'unknown',
    'blocked',
    'not_applicable',
    'degraded',
    'failed'
  )),
  max_evidence_age_seconds integer check (
    max_evidence_age_seconds is null or max_evidence_age_seconds > 0
  ),
  blocking boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 12000
  ),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, environment, domain, requirement)
);

alter table public.atlas_infrastructure_assurance_policies enable row level security;

drop policy if exists atlas_infrastructure_assurance_policies_read
  on public.atlas_infrastructure_assurance_policies;
create policy atlas_infrastructure_assurance_policies_read
on public.atlas_infrastructure_assurance_policies
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.org_id = atlas_infrastructure_assurance_policies.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
  and public.has_identity_permission(org_id, 'releases.read')
);

create index if not exists idx_atlas_infrastructure_assurance_policies_org_env_domain
  on public.atlas_infrastructure_assurance_policies(
    org_id,
    environment,
    domain,
    severity,
    blocking
  );

revoke all on table public.atlas_infrastructure_assurance_policies from anon;
revoke insert, update, delete on table public.atlas_infrastructure_assurance_policies from authenticated;
grant select on table public.atlas_infrastructure_assurance_policies to authenticated;

comment on table public.atlas_infrastructure_assurance_policies is
'Organization-scoped ATLAS Infrastructure Assurance desired-state policy. Observed provider state and evidence are stored in canonical evidence systems, never in this table.';
