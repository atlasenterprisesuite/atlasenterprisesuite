-- F19 isolated integration candidate; not a production migration.
-- Depends on real auth.uid(), has_identity_permission(uuid,text), and organization_members.
-- Deliberately ungranted to anon/authenticated/service_role pending role-revocation proof.
-- Caller actor is never accepted as an argument.
create or replace function public.robotics_f19_guarded_complete(
  p_tenant text, p_org uuid, p_run text
) returns boolean language plpgsql security invoker
set search_path = pg_catalog, public as $$
declare v_actor uuid;
declare v_status text;
begin
  v_actor := auth.uid();
  if v_actor is null or p_org is null or p_tenant is null
     or p_tenant is distinct from p_org::text
     or p_run is null or p_run !~ '^[A-Za-z0-9_-]{1,128}$' then
    return false;
  end if;
  -- All revocation writers MUST acquire the same exclusive advisory lock.
  perform pg_advisory_xact_lock_shared(777019, hashtext(p_org::text));
  select om.status into v_status from public.organization_members om
    where om.org_id=p_org and om.user_id=v_actor for update;
  if v_status is distinct from 'active' then return false; end if;
  -- P0: role-permission revocation still needs matching lock protocol.
  if not coalesce(public.has_identity_permission(p_org,'execution.write'),false)
    then return false; end if;
  return public.robotics_simulation_complete(p_tenant,p_org,p_run);
end $$;
revoke all on function public.robotics_f19_guarded_complete(text,uuid,text)
  from public, anon, authenticated, service_role;
-- Fail closed: do not GRANT EXECUTE or expose via PostgREST.
