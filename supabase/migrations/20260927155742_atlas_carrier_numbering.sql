create table if not exists public.atlas_numbering_authorizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mode text not null check (mode in ('partner','direct')),
  state text not null default 'not_started'
    check (state in ('not_started','partner_path','fcc_application_pending','fcc_authorized','nanpa_ready','suspended','revoked')),
  authority_reference text,
  ocn text,
  spid text,
  facilities_ready boolean not null default false,
  e911_ready boolean not null default false,
  robocall_mitigation_ready boolean not null default false,
  evidence jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, mode)
);
create table if not exists public.atlas_number_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  authorization_id uuid references public.atlas_numbering_authorizations(id) on delete restrict,
  e164 text not null check (e164 ~ '^\+1[2-9][0-9]{9}$'),
  country_code text not null default 'US' check (country_code = 'US'),
  area_code text not null check (area_code ~ '^[2-9][0-9]{2}$'),
  rate_center text,
  state text not null default 'reserved'
    check (state in ('unavailable','reserved','assigned','active','suspended','released')),
  upstream_provider text,
  external_resource_id text,
  assigned_service text check (assigned_service is null or assigned_service in ('communication','wireless','fax','other')),
  provider_evidence jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, e164)
);
create index if not exists atlas_numbering_authorizations_org_idx on public.atlas_numbering_authorizations (organization_id, state, updated_at desc);
create index if not exists atlas_number_resources_org_state_idx on public.atlas_number_resources (organization_id, state, updated_at desc);
alter table public.atlas_numbering_authorizations enable row level security;
alter table public.atlas_number_resources enable row level security;
create policy atlas_numbering_authorizations_member_read on public.atlas_numbering_authorizations for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = atlas_numbering_authorizations.organization_id and om.user_id = auth.uid() and om.status = 'active')
);
create policy atlas_number_resources_member_read on public.atlas_number_resources for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = atlas_number_resources.organization_id and om.user_id = auth.uid() and om.status = 'active')
);
revoke all on public.atlas_numbering_authorizations from authenticated;
revoke all on public.atlas_number_resources from authenticated;
grant select on public.atlas_numbering_authorizations to authenticated;
grant select on public.atlas_number_resources to authenticated;
