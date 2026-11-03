-- ATLAS 777 PR #976: internal-only finalization/revocation primitives.
-- These functions have NO API EXECUTE grants and cannot be called through PostgREST.
-- Lock order for all paths: organization_members -> execution_browser_idempotency.
-- A trusted database executor is required; do not expose as SECURITY DEFINER API RPC.
create or replace function public.atlas_browser_finish_777(
  p_reservation uuid, p_org_id uuid, p_tenant_id text,
  p_key text, p_action_digest text, p_state text
) returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_actor uuid := (select auth.uid()); v_row uuid;
begin
  if v_actor is null or p_state not in ('completed','indeterminate')
     or p_action_digest !~ '^[a-f0-9]{64}$'
  then raise exception 'browser_finish_denied' using errcode = '42501'; end if;
  perform 1 from public.organization_members m
    where m.org_id = p_org_id and m.user_id = v_actor and m.status = 'active'
    for share;
  if not found then raise exception 'browser_membership_revoked' using errcode = '42501'; end if;
  select b.id into v_row from public.execution_browser_idempotency b
    where b.id = p_reservation and b.org_id = p_org_id
      and b.tenant_id = p_tenant_id and b.idempotency_key = p_key
      and b.actor_user_id = v_actor and b.action_digest = p_action_digest
      and b.state = 'reserved' for update;
  if v_row is null then raise exception 'browser_reservation_invalid' using errcode = '42501'; end if;
  update public.execution_browser_idempotency
    set state = p_state, updated_at = clock_timestamp()
    where id = v_row and state = 'reserved';
  return true;
end;
$$;
revoke all on function public.atlas_browser_finish_777(uuid,uuid,text,text,text,text) from public, anon, authenticated;

-- Revocation requires a separate trusted actor-authorized control plane.
-- The actor and organization MUST be validated upstream in the same transaction.
-- No public or authenticated EXECUTE grant.
create or replace function public.atlas_browser_revoke_actor_777(
  p_org_id uuid, p_actor uuid
) returns integer language plpgsql security invoker set search_path = ''
as $$
declare v_count integer;
begin
  if p_org_id is null or p_actor is null then
    raise exception 'browser_revoke_invalid' using errcode = '42501'; end if;
  -- A row lock on the membership, if present, serializes with finish/reserve.
  perform 1 from public.organization_members m
    where m.org_id = p_org_id and m.user_id = p_actor for update;
  update public.execution_browser_idempotency b
    set state = 'revoked', updated_at = clock_timestamp()
    where b.org_id = p_org_id and b.actor_user_id = p_actor and b.state = 'reserved';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.atlas_browser_revoke_actor_777(uuid,uuid) from public, anon, authenticated;
comment on function public.atlas_browser_revoke_actor_777(uuid,uuid)
  is 'Internal-only; caller MUST authenticate and authorize revocation in the same transaction. Not safe to grant to API roles.';
