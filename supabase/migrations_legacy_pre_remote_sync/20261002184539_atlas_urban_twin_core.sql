-- ATLAS Urban Twin Core
-- Canonical organization-scoped hierarchy for districts, facilities, spaces and assets.
-- Browser access is read-only. Operational mutation and telemetry ingestion remain server-controlled.

insert into public.identity_permissions (code, description)
values
  ('city.twin.read', 'Read organization-scoped ATLAS Urban Twin entities, bindings and observations.'),
  ('city.twin.manage', 'Manage organization-scoped ATLAS Urban Twin entities and verified bindings through governed server workflows.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'city.twin.read'),
  ('owner', 'city.twin.manage'),
  ('admin', 'city.twin.read'),
  ('admin', 'city.twin.manage'),
  ('manager', 'city.twin.read'),
  ('manager', 'city.twin.manage'),
  ('staff', 'city.twin.read')
on conflict do nothing;

create table if not exists public.atlas_urban_twin_entities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  parent_id uuid,
  entity_type text not null
    check (entity_type in ('district','site','building','floor','space','asset','infrastructure')),
  name text not null check (char_length(btrim(name)) between 1 and 180),
  external_ref text,
  source_kind text not null default 'manual'
    check (source_kind in ('manual','cleanscan','device','gps','work','import')),
  lifecycle_state text not null default 'planned'
    check (lifecycle_state in ('planned','active','retired')),
  verification_state text not null default 'unverified'
    check (verification_state in ('simulation','unverified','verified','revoked')),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  altitude_m double precision,
  geometry jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_urban_twin_entities_tenant_scope check (tenant_id = org_id),
  constraint atlas_urban_twin_entities_geometry_object check (jsonb_typeof(geometry) = 'object'),
  constraint atlas_urban_twin_entities_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint atlas_urban_twin_entities_position_pair check (
    (latitude is null and longitude is null) or (latitude is not null and longitude is not null)
  ),
  constraint atlas_urban_twin_entities_id_org_key unique (id, org_id),
  constraint atlas_urban_twin_entities_parent_scope_fkey
    foreign key (parent_id, org_id)
    references public.atlas_urban_twin_entities(id, org_id)
    on delete restrict
);

create table if not exists public.atlas_urban_twin_bindings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid not null,
  binding_type text not null
    check (binding_type in ('cleanscan','device','gps','work','sensor','network','facility')),
  adapter text not null check (char_length(btrim(adapter)) between 1 and 120),
  external_ref text not null check (char_length(btrim(external_ref)) between 1 and 240),
  verification_state text not null default 'unverified'
    check (verification_state in ('unverified','verified','degraded','revoked')),
  last_verified_at timestamptz,
  evidence_refs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_urban_twin_bindings_tenant_scope check (tenant_id = org_id),
  constraint atlas_urban_twin_bindings_evidence_array check (jsonb_typeof(evidence_refs) = 'array'),
  constraint atlas_urban_twin_bindings_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint atlas_urban_twin_bindings_entity_scope_fkey
    foreign key (entity_id, org_id)
    references public.atlas_urban_twin_entities(id, org_id)
    on delete cascade,
  constraint atlas_urban_twin_bindings_id_org_key unique (id, org_id),
  constraint atlas_urban_twin_bindings_external_key unique (org_id, binding_type, adapter, external_ref)
);

create table if not exists public.atlas_urban_twin_observations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid not null,
  binding_id uuid,
  observation_type text not null
    check (observation_type in ('telemetry','status','location','inspection','maintenance')),
  provenance text not null
    check (provenance in ('simulation','authenticated')),
  metric_key text not null check (char_length(btrim(metric_key)) between 1 and 160),
  value jsonb not null default '{}'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  constraint atlas_urban_twin_observations_tenant_scope check (tenant_id = org_id),
  constraint atlas_urban_twin_observations_evidence_array check (jsonb_typeof(evidence_refs) = 'array'),
  constraint atlas_urban_twin_observations_entity_scope_fkey
    foreign key (entity_id, org_id)
    references public.atlas_urban_twin_entities(id, org_id)
    on delete cascade,
  constraint atlas_urban_twin_observations_binding_scope_fkey
    foreign key (binding_id, org_id)
    references public.atlas_urban_twin_bindings(id, org_id)
    on delete set null
);

create index if not exists atlas_urban_twin_entities_org_parent_idx
  on public.atlas_urban_twin_entities(org_id, parent_id, entity_type, name);
create index if not exists atlas_urban_twin_entities_org_verified_idx
  on public.atlas_urban_twin_entities(org_id, verification_state, updated_at desc);
create index if not exists atlas_urban_twin_bindings_entity_idx
  on public.atlas_urban_twin_bindings(org_id, entity_id, binding_type);
create index if not exists atlas_urban_twin_bindings_state_idx
  on public.atlas_urban_twin_bindings(org_id, verification_state, updated_at desc);
create index if not exists atlas_urban_twin_observations_entity_time_idx
  on public.atlas_urban_twin_observations(org_id, entity_id, observed_at desc);
create index if not exists atlas_urban_twin_observations_binding_time_idx
  on public.atlas_urban_twin_observations(org_id, binding_id, observed_at desc)
  where binding_id is not null;

create or replace function public.atlas_urban_twin_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists atlas_urban_twin_entities_touch on public.atlas_urban_twin_entities;
create trigger atlas_urban_twin_entities_touch
before update on public.atlas_urban_twin_entities
for each row execute function public.atlas_urban_twin_touch_updated_at();

drop trigger if exists atlas_urban_twin_bindings_touch on public.atlas_urban_twin_bindings;
create trigger atlas_urban_twin_bindings_touch
before update on public.atlas_urban_twin_bindings
for each row execute function public.atlas_urban_twin_touch_updated_at();

alter table public.atlas_urban_twin_entities enable row level security;
alter table public.atlas_urban_twin_bindings enable row level security;
alter table public.atlas_urban_twin_observations enable row level security;

revoke all on public.atlas_urban_twin_entities from anon;
revoke all on public.atlas_urban_twin_bindings from anon;
revoke all on public.atlas_urban_twin_observations from anon;

revoke insert, update, delete on public.atlas_urban_twin_entities from authenticated;
revoke insert, update, delete on public.atlas_urban_twin_bindings from authenticated;
revoke insert, update, delete on public.atlas_urban_twin_observations from authenticated;

grant select on public.atlas_urban_twin_entities to authenticated;
grant select on public.atlas_urban_twin_bindings to authenticated;
grant select on public.atlas_urban_twin_observations to authenticated;

grant all on public.atlas_urban_twin_entities to service_role;
grant all on public.atlas_urban_twin_bindings to service_role;
grant all on public.atlas_urban_twin_observations to service_role;

drop policy if exists atlas_urban_twin_entities_read on public.atlas_urban_twin_entities;
create policy atlas_urban_twin_entities_read
on public.atlas_urban_twin_entities
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = atlas_urban_twin_entities.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
  and (
    public.has_identity_permission(org_id, 'city.twin.read')
    or public.has_identity_permission(org_id, 'city.twin.manage')
  )
);

drop policy if exists atlas_urban_twin_bindings_read on public.atlas_urban_twin_bindings;
create policy atlas_urban_twin_bindings_read
on public.atlas_urban_twin_bindings
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = atlas_urban_twin_bindings.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
  and (
    public.has_identity_permission(org_id, 'city.twin.read')
    or public.has_identity_permission(org_id, 'city.twin.manage')
  )
);

drop policy if exists atlas_urban_twin_observations_read on public.atlas_urban_twin_observations;
create policy atlas_urban_twin_observations_read
on public.atlas_urban_twin_observations
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = atlas_urban_twin_observations.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
  and (
    public.has_identity_permission(org_id, 'city.twin.read')
    or public.has_identity_permission(org_id, 'city.twin.manage')
  )
);

comment on table public.atlas_urban_twin_entities is
  'Canonical ATLAS Urban Twin hierarchy. Verification state is explicit and never inferred from source_kind.';
comment on table public.atlas_urban_twin_bindings is
  'External bindings for Urban Twin entities. A binding is live only when verification_state=verified and evidence exists.';
comment on table public.atlas_urban_twin_observations is
  'Server-ingested Urban Twin observations. provenance distinguishes simulation from authenticated evidence.';