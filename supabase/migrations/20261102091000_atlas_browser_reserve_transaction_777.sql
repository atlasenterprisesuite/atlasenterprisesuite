-- ATLAS 777 PR #976. Server-only transactional reservation.
-- Requires the base organization_members and execution tables.
-- Must be invoked by a trusted, user-scoped database session; auth.uid() is never caller-supplied.
-- Lock order: organization_members -> execution_browser_idempotency.
create or replace function public.atlas_browser_reserve_777(
  p_org_id uuid, p_tenant_id text, p_key text,
  p_workflow_id uuid, p_step_id uuid, p_action_digest text
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare v_actor uuid := (select auth.uid()); v_id uuid;
begin
  if v_actor is null or p_org_id is null or p_tenant_id is null or p_key is null
     or p_workflow_id is null or p_step_id is null or p_action_digest !~ '^[a-f0-9]{64}$'
  then raise exception 'browser_reservation_denied' using errcode = '42501'; end if;
  -- FOR SHARE conflicts with membership deletion/status update; recheck after waiting.
  perform 1 from public.organization_members m
   where m.org_id = p_org_id and m.user_id = v_actor and m.status = 'active'
   for share;
  if not found then raise exception 'browser_membership_revoked' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.execution_workflows w
    join public.execution_steps s on s.id = p_step_id and s.org_id = w.org_id and s.tenant_id = w.tenant_id
    where w.id = p_workflow_id and w.org_id = p_org_id and w.tenant_id = p_tenant_id
  ) then raise exception 'browser_scope_denied' using errcode = '42501'; end if;
  insert into public.execution_browser_idempotency
    (org_id,tenant_id,idempotency_key,workflow_id,step_id,actor_user_id,action_digest)
    values (p_org_id,p_tenant_id,p_key,p_workflow_id,p_step_id,v_actor,p_action_digest)
    on conflict (org_id,tenant_id,idempotency_key) do nothing
    returning id into v_id;
  if v_id is null then raise exception 'browser_duplicate_or_indeterminate' using errcode = '23505'; end if;
  return v_id;
end;
$$;
-- No grant: this is deliberately NOT callable by authenticated/anon/API roles.
revoke all on function public.atlas_browser_reserve_777(uuid,text,text,uuid,uuid,text) from public, anon, authenticated;
comment on function public.atlas_browser_reserve_777(uuid,text,text,uuid,uuid,text)
  is 'Internal prerequisite only. Requires trusted database execution and membership locking; no public RPC access.';
