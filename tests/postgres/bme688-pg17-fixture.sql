-- Synthetic PostgreSQL 17 CI fixture, isolated from ATLAS production.
-- Reduced but constraint-compatible schema for candidate function tests.
create role service_role nologin bypassrls;
create role authenticated nologin;
create role anon nologin;

create table public.atlas_local_agents (
  id uuid primary key,
  org_id uuid not null,
  status text not null check (status in ('online','offline','revoked')),
  unique (id,org_id)
);
create table public.atlas_local_agent_sessions (
  id uuid primary key,
  org_id uuid not null,
  agent_id uuid not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  foreign key (agent_id,org_id) references public.atlas_local_agents(id,org_id)
);
create table public.atlas_local_devices (
  id uuid primary key,
  org_id uuid not null,
  agent_id uuid not null,
  adapter text not null,
  device_type text not null,
  health_status text not null,
  foreign key (agent_id,org_id) references public.atlas_local_agents(id,org_id)
);
create table public.atlas_urban_twin_entities (
  id uuid primary key,
  org_id uuid not null,
  verification_state text not null,
  lifecycle_state text not null,
  unique (id,org_id)
);
create table public.atlas_urban_twin_bindings (
  id uuid primary key,
  org_id uuid not null,
  tenant_id uuid not null check (tenant_id = org_id),
  entity_id uuid not null,
  binding_type text not null,
  adapter text not null,
  external_ref text not null,
  verification_state text not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  foreign key (entity_id,org_id) references public.atlas_urban_twin_entities(id,org_id),
  unique (id,org_id)
);
create table public.atlas_urban_twin_observations (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  tenant_id uuid not null check (tenant_id=org_id),
  entity_id uuid not null,
  binding_id uuid,
  observation_type text not null check (observation_type in ('telemetry','status','location','inspection','maintenance')),
  provenance text not null check (provenance in ('simulation','authenticated')),
  metric_key text not null,
  value jsonb not null,
  observed_at timestamptz not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  foreign key (entity_id,org_id) references public.atlas_urban_twin_entities(id,org_id),
  foreign key (binding_id,org_id) references public.atlas_urban_twin_bindings(id,org_id)
);
create table public.atlas_local_device_events (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  agent_id uuid,
  device_id uuid,
  event_type text not null,
  severity text not null,
  success boolean,
  safe_detail jsonb not null default '{}'::jsonb
);
alter table public.atlas_local_agents enable row level security;
alter table public.atlas_local_agent_sessions enable row level security;
alter table public.atlas_local_devices enable row level security;
alter table public.atlas_urban_twin_entities enable row level security;
alter table public.atlas_urban_twin_bindings enable row level security;
alter table public.atlas_urban_twin_observations enable row level security;
alter table public.atlas_local_device_events enable row level security;
grant select, insert, update on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Two independent synthetic organizations. Only A's device and binding are authorized.
insert into public.atlas_local_agents (id,org_id,status) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','online'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','22222222-2222-4222-8222-222222222222','online');
insert into public.atlas_local_agent_sessions(id,org_id,agent_id,expires_at) values
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', now()+interval '1 hour'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', now()+interval '1 hour');
insert into public.atlas_local_devices(id,org_id,agent_id,adapter,device_type,health_status) values
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','bme688','sensor','healthy'),
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','bme688','sensor','healthy');
insert into public.atlas_urban_twin_entities(id,org_id,verification_state,lifecycle_state) values
 ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1','11111111-1111-4111-8111-111111111111','verified','active'),
 ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2','22222222-2222-4222-8222-222222222222','verified','active');
insert into public.atlas_urban_twin_bindings
 (id,org_id,tenant_id,entity_id,binding_type,adapter,external_ref,verification_state,evidence_refs)
values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-ddddddddddd1','sensor','bme688','cccccccc-cccc-4ccc-8ccc-ccccccccccc1','verified','["synthetic-fixture-evidence"]'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','dddddddd-dddd-4ddd-8ddd-ddddddddddd2','sensor','bme688','cccccccc-cccc-4ccc-8ccc-ccccccccccc2','verified','["synthetic-fixture-evidence"]');
