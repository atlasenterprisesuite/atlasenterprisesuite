-- F5 ISOLATED POSTGRESQL PROTOTYPE. DO NOT APPLY TO PRODUCTION.
-- Requires the F4 draft table in a disposable PostgreSQL database.
-- Caller actor identity is derived from auth.uid(); membership and tenant scope still require authoritative verification.
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
  p_tenant text,p_org uuid,p_run text
) returns boolean language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_actor uuid := auth.uid();
declare allowed boolean;
begin
  if v_actor is null then return false; end if;
  if p_run !~ '^[A-Za-z0-9_-]{1,128}$' then raise exception 'invalid_run'; end if;
  select enabled into allowed from public.atlas_robotics_simulation_grants
    where tenant_id=p_tenant and org_id=p_org and actor_id=v_actor for update;
  if allowed is distinct from true then return false; end if;
  insert into public.atlas_robotics_simulation_runs(tenant_id,org_id,run_id,status)
    values(p_tenant,p_org,p_run,'reserved') on conflict do nothing;
  return found;
end $$;
create or replace function public.robotics_simulation_complete(
  p_tenant text,p_org uuid,p_run text
) returns boolean language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_actor uuid := auth.uid();
declare allowed boolean;
begin
  if v_actor is null then return false; end if;
  select enabled into allowed from public.atlas_robotics_simulation_grants
    where tenant_id=p_tenant and org_id=p_org and actor_id=v_actor for update;
  if allowed is distinct from true then return false; end if;
  update public.atlas_robotics_simulation_runs set status='completed',updated_at=now()
    where tenant_id=p_tenant and org_id=p_org and run_id=p_run and status='reserved';
  return found;
end $$;
create or replace function public.robotics_simulation_revoke(
  p_tenant text,p_org uuid
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then return; end if;
  update public.atlas_robotics_simulation_grants set enabled=false
    where tenant_id=p_tenant and org_id=p_org and actor_id=v_actor;
end $$;
revoke all on function public.robotics_simulation_reserve(text,uuid,text) from public,anon,authenticated;
revoke all on function public.robotics_simulation_complete(text,uuid,text) from public,anon,authenticated;
revoke all on function public.robotics_simulation_revoke(text,uuid) from public,anon,authenticated;
-- PostgreSQL concurrency contract:
-- Session A: BEGIN; SELECT robotics_simulation_complete(...); keep transaction open.
-- Session B: BEGIN; SELECT robotics_simulation_revoke(...); blocks on same grant row.
-- A COMMIT; B resumes; B COMMIT. Reversed ordering must make complete return false.
-- F5 does not yet demonstrate this contract by executing PostgreSQL.

-- F6: stop operations. Same grant-row lock ordering as reserve/complete/revoke.
-- Only a trusted database role with explicit grants can invoke these.
create or replace function public.robotics_simulation_halt(
  p_tenant text,p_org uuid,p_run text
) returns boolean language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_actor uuid := auth.uid();
declare allowed boolean;
begin
  if v_actor is null then return false; end if;
  if p_run !~ '^[A-Za-z0-9_-]{1,128}$' then return false; end if;
  select enabled into allowed from public.atlas_robotics_simulation_grants
    where tenant_id=p_tenant and org_id=p_org and actor_id=v_actor for update;
  if allowed is distinct from true then return false; end if;
  insert into public.atlas_robotics_simulation_runs(tenant_id,org_id,run_id,status)
    values(p_tenant,p_org,p_run,'halted')
    on conflict (tenant_id,org_id,run_id) do update
      set status='halted', updated_at=now()
      where atlas_robotics_simulation_runs.status in ('reserved','halted');
  return found;
end $$;
create or replace function public.robotics_simulation_is_halted(
  p_tenant text,p_org uuid,p_run text
) returns boolean language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_actor uuid := auth.uid();
declare allowed boolean;
declare stopped boolean;
begin
  if v_actor is null then return true; end if;
  if p_run !~ '^[A-Za-z0-9_-]{1,128}
  select enabled into allowed from public.atlas_robotics_simulation_grants
    where tenant_id=p_tenant and org_id=p_org and actor_id=v_actor for update;
  if allowed is distinct from true then return true; end if;
  select status='halted' into stopped from public.atlas_robotics_simulation_runs
    where tenant_id=p_tenant and org_id=p_org and run_id=p_run;
  return coalesce(stopped,false);
end $$;
revoke all on function public.robotics_simulation_halt(text,uuid,text) from public,anon,authenticated;
revoke all on function public.robotics_simulation_is_halted(text,uuid,text) from public,anon,authenticated;
-- NOTE: A halt after completion does not undo a completed run.
-- P0: Membership, tenant binding, and role-revocation serialization remain unproven.
-- Do not expose these functions to API roles.
 then return true; end if;
  select enabled into allowed from public.atlas_robotics_simulation_grants
    where tenant_id=p_tenant and org_id=p_org and actor_id=v_actor for update;
  if allowed is distinct from true then return true; end if;
  select status='halted' into stopped from public.atlas_robotics_simulation_runs
    where tenant_id=p_tenant and org_id=p_org and run_id=p_run;
  return coalesce(stopped,false);
end $$;
revoke all on function public.robotics_simulation_halt(text,uuid,text) from public,anon,authenticated;
revoke all on function public.robotics_simulation_is_halted(text,uuid,text) from public,anon,authenticated;
-- NOTE: A halt after completion does not undo a completed run.
-- Authorization gap: actor_id is caller-supplied; these functions MUST NOT be
-- exposed until bound to verified identity, membership and tenant claims.
