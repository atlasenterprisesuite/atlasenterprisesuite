-- ATLAS sovereign DNS control plane: persistent, tenant-isolated zone snapshots.
-- Apply only after migration review. No production DNS changes performed.
create table if not exists public.atlas_dns_zones (
  tenant_id uuid not null,
  zone_name text not null,
  version bigint not null default 0 check (version >= 0),
  records jsonb not null default '[]'::jsonb check (jsonb_typeof(records) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, zone_name),
  constraint atlas_dns_zone_name_lowercase check (zone_name = lower(zone_name) and length(zone_name) between 3 and 253)
);
create table if not exists public.atlas_dns_zone_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  zone_name text not null,
  actor_id uuid not null,
  version bigint not null,
  event_type text not null check (event_type = 'zone.snapshot.committed'),
  recorded_at timestamptz not null default now()
);
create index if not exists atlas_dns_zone_events_tenant_idx on public.atlas_dns_zone_events (tenant_id, zone_name, recorded_at desc);
alter table public.atlas_dns_zones enable row level security;
alter table public.atlas_dns_zones force row level security;
alter table public.atlas_dns_zone_events enable row level security;
alter table public.atlas_dns_zone_events force row level security;
revoke all on public.atlas_dns_zones from public, anon, authenticated;
revoke all on public.atlas_dns_zone_events from public, anon, authenticated;
-- This RPC is intentionally NOT granted to API users. It is called only by a
-- trusted server role after verified JWT, tenant membership, RBAC, and validation.
-- Database audit and snapshot commit in one transaction: no partial success.
create or replace function public.atlas_dns_commit_zone(
  p_tenant_id uuid,
  p_zone_name text,
  p_actor_id uuid,
  p_expected_version bigint,
  p_records jsonb
) returns bigint
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_version bigint;
begin
  if p_tenant_id is null or p_actor_id is null or p_zone_name is null
     or p_zone_name <> lower(p_zone_name) or length(p_zone_name) not between 3 and 253
     or p_expected_version is null or p_expected_version < 0
     or p_records is null or jsonb_typeof(p_records) <> 'array'
     or jsonb_array_length(p_records) > 500 then
    raise exception 'Invalid DNS zone mutation';
  end if;
  insert into public.atlas_dns_zones (tenant_id, zone_name, version, records)
  values (p_tenant_id, p_zone_name, 0, '[]'::jsonb)
  on conflict (tenant_id, zone_name) do nothing;
  update public.atlas_dns_zones
     set version = version + 1, records = p_records, updated_at = now()
   where tenant_id = p_tenant_id and zone_name = p_zone_name and version = p_expected_version
   returning version into v_version;
  if v_version is null then raise exception 'DNS zone version conflict'; end if;
  insert into public.atlas_dns_zone_events(tenant_id, zone_name, actor_id, version, event_type)
  values(p_tenant_id, p_zone_name, p_actor_id, v_version, 'zone.snapshot.committed');
  return v_version;
end;
$$;
revoke all on function public.atlas_dns_commit_zone(uuid,text,uuid,bigint,jsonb) from public, anon, authenticated;
-- IMPORTANT: deployer must explicitly grant EXECUTE to a restricted backend role
-- with the minimum necessary table permissions. Do not grant to client roles.
