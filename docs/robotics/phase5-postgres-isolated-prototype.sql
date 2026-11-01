-- F5 ISOLATED POSTGRESQL PROTOTYPE. DO NOT APPLY TO PRODUCTION.
-- Requires the F4 draft table in a disposable PostgreSQL database.
-- The trusted caller must authenticate membership and tenant scope separately.
-- These routines do not authorize callers; no EXECUTE privileges are granted to API roles.
-- IMPORTANT: revocation of membership outside these functions is NOT serialized.
-- Only the local simulation grant table below is protected by the same row lock.
create table if not exists public.atlas_robotics_simulation_grants (
  tenant_id text not null,
  org_id uuid not null references public.organizations(id),
  actor_id uuid not null,
  enabled boolean not null default false,
  primary key (tenant_id,org_id,actor_id)
);
alter table public.atlas_robotics_simulation_grants enable row level security;
alter table public.atlas_robotics_simulation_grants force row level security;
revoke all on public.atlas_robotics_simulation_grants from public,anon,authenticated;
create or replace function public.robotics_simulation_reserve(
  p_tenant text,p_org uuid,p_actor uuid,p_run text
) returns boolean language plpgsql security invoker set search_path = pg_catalog, public as $$
declare allowed boolean;
begin
  if p_run !~ '^[A-Za-z0-9_-]{1,128}$' then raise exception 'invalid_run'; end if;
  select enabled into allowed from public.atlas_robotics_simulation_grants
    where tenant_id=p_tenant and org_id=p_org and actor_id=p_actor for update;
  if allowed is distinct from true then return false; end if;
  insert into public.atlas_robotics_simulation_runs(tenant_id,org_id,run_id,status)
    values(p_tenant,p_org,p_run,'reserved') on conflict do nothing;
  return found;
end $$;
create or replace function public.robotics_simulation_complete(
  p_tenant text,p_org uuid,p_actor uuid,p_run text
) returns boolean language plpgsql security invoker set search_path = pg_catalog, public as $$
declare allowed boolean;
begin
  select enabled into allowed from public.atlas_robotics_simulation_grants
    where tenant_id=p_tenant and org_id=p_org and actor_id=p_actor for update;
  if allowed is distinct from true then return false; end if;
  update public.atlas_robotics_simulation_runs set status='completed',updated_at=now()
    where tenant_id=p_tenant and org_id=p_org and run_id=p_run and status='reserved';
  return found;
end $$;
create or replace function public.robotics_simulation_revoke(
  p_tenant text,p_org uuid,p_actor uuid
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  update public.atlas_robotics_simulation_grants set enabled=false
    where tenant_id=p_tenant and org_id=p_org and actor_id=p_actor;
end $$;
revoke all on function public.robotics_simulation_reserve(text,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.robotics_simulation_complete(text,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.robotics_simulation_revoke(text,uuid,uuid) from public,anon,authenticated;
-- PostgreSQL concurrency contract:
-- Session A: BEGIN; SELECT robotics_simulation_complete(...); keep transaction open.
-- Session B: BEGIN; SELECT robotics_simulation_revoke(...); blocks on same grant row.
-- A COMMIT; B resumes; B COMMIT. Reversed ordering must make complete return false.
-- F5 does not yet demonstrate this contract by executing PostgreSQL.
