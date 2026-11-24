create table if not exists public.hospitality_provider_instances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id text not null check (length(trim(property_id)) > 0),
  provider_type text not null check (provider_type in (
    'salto_ks',
    'salto_space_hospitality',
    'vingcard_vconnect',
    'vingcard_vostio',
    'vingcard_visionline',
    'dormakaba_ambiance_cloud',
    'dormakaba_ambiance_soap',
    'dormakaba_ambiance_rest',
    'dormakaba_pms_bridge',
    'generic_certified'
  )),
  display_name text not null check (length(trim(display_name)) > 0),
  state text not null default 'not_configured' check (state in (
    'not_configured',
    'configured_unverified',
    'ready',
    'degraded',
    'offline',
    'disabled'
  )),
  provider_property_id text,
  capabilities text[] not null default '{}'::text[],
  configuration_version integer not null default 1 check (configuration_version > 0),
  last_verified_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, property_id, provider_type)
);

create table if not exists public.hospitality_room_mappings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id text not null check (length(trim(property_id)) > 0),
  provider_instance_id uuid not null references public.hospitality_provider_instances(id) on delete cascade,
  atlas_room_id text not null check (length(trim(atlas_room_id)) > 0),
  provider_room_id text not null check (length(trim(provider_room_id)) > 0),
  provider_lock_id text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'invalid', 'disabled')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_instance_id, atlas_room_id),
  unique (provider_instance_id, provider_room_id)
);

create table if not exists public.hospitality_credential_references (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id text not null check (length(trim(property_id)) > 0),
  room_id text not null check (length(trim(room_id)) > 0),
  provider_instance_id uuid not null references public.hospitality_provider_instances(id) on delete restrict,
  provider_credential_id text not null check (length(trim(provider_credential_id)) > 0),
  assignment_reference text not null check (length(trim(assignment_reference)) > 0),
  credential_type text not null default 'provider_reference' check (credential_type in ('mobile_key', 'rfid_reference', 'provider_reference')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'issued' check (status in ('issued', 'revoked', 'expired', 'failed', 'unknown')),
  issued_by uuid not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  provider_status_code integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at),
  unique (provider_instance_id, provider_credential_id)
);

create index if not exists hospitality_provider_instances_org_property_idx
  on public.hospitality_provider_instances (org_id, property_id, state);

create index if not exists hospitality_room_mappings_org_property_room_idx
  on public.hospitality_room_mappings (org_id, property_id, atlas_room_id, status);

create index if not exists hospitality_credential_refs_org_property_status_idx
  on public.hospitality_credential_references (org_id, property_id, status, expires_at);

alter table public.hospitality_provider_instances enable row level security;
alter table public.hospitality_room_mappings enable row level security;
alter table public.hospitality_credential_references enable row level security;

drop policy if exists hospitality_provider_instances_member_read on public.hospitality_provider_instances;
create policy hospitality_provider_instances_member_read
on public.hospitality_provider_instances
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.org_id = hospitality_provider_instances.org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

drop policy if exists hospitality_room_mappings_member_read on public.hospitality_room_mappings;
create policy hospitality_room_mappings_member_read
on public.hospitality_room_mappings
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.org_id = hospitality_room_mappings.org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

drop policy if exists hospitality_credential_references_member_read on public.hospitality_credential_references;
create policy hospitality_credential_references_member_read
on public.hospitality_credential_references
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.org_id = hospitality_credential_references.org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

revoke all on public.hospitality_provider_instances from authenticated;
revoke all on public.hospitality_room_mappings from authenticated;
revoke all on public.hospitality_credential_references from authenticated;

grant select on public.hospitality_provider_instances to authenticated;
grant select on public.hospitality_room_mappings to authenticated;
grant select on public.hospitality_credential_references to authenticated;

comment on table public.hospitality_provider_instances is
  'Authorized hotel access provider metadata. Provider secrets are never stored in this table.';

comment on table public.hospitality_room_mappings is
  'ATLAS-to-provider room mapping metadata scoped by organization and property.';

comment on table public.hospitality_credential_references is
  'External hotel credential references and lifecycle metadata only; no raw credential material.';
