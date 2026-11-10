create or replace function atlas_private.transition_release_internal(
  p_release_id uuid,
  p_target_status text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path='public','atlas_private','pg_temp'
as $$
declare r public.atlas_releases; v_now timestamptz:=now(); v_actor uuid:=auth.uid(); v_role text:=coalesce(current_setting('request.jwt.claim.role',true),''); v_admin boolean:=false;
begin
  select * into r from public.atlas_releases where id=p_release_id for update;
  if not found then raise exception 'release_not_found'; end if;
  if r.status='draft' and p_target_status='candidate' then raise exception 'use_atlas_freeze_release'; end if;
  if not public.atlas_release_transition_allowed(r.status,p_target_status) then raise exception 'invalid_release_transition'; end if;
  v_admin := session_user='postgres' or v_role='service_role';
  if not v_admin then
    if r.org_id is not null then
      if v_actor is null or not public.has_identity_permission(r.org_id,'releases.manage') then raise exception 'permission_denied'; end if;
    else
      if v_actor is null or not atlas_private.is_release_platform_admin(v_actor) then raise exception 'permission_denied'; end if;
    end if;
  end if;
  update public.atlas_releases
  set status=p_target_status,
      promoted_at=case when p_target_status='promoted' then v_now else promoted_at end,
      cancelled_at=case when p_target_status='cancelled' then v_now else cancelled_at end,
      metadata=metadata || case when p_reason is null then '{}'::jsonb else jsonb_build_object('transition_reason',left(p_reason,300)) end,
      updated_at=v_now
  where id=p_release_id;
  return jsonb_build_object('id',p_release_id,'from',r.status,'to',p_target_status,'updated_at',v_now);
end;
$$;
