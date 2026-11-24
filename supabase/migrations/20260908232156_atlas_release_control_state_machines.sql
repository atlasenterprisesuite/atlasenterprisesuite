create or replace function public.atlas_release_transition_allowed(p_from text,p_to text)
returns boolean language sql immutable set search_path='public','pg_temp' as $$
  select case p_from
    when 'draft' then p_to in ('candidate','cancelled')
    when 'candidate' then p_to in ('validating','blocked','failed','cancelled')
    when 'validating' then p_to in ('ready','awaiting_approval','blocked','failed','cancelled')
    when 'awaiting_approval' then p_to in ('validating','ready','blocked','cancelled')
    when 'ready' then p_to in ('deploying','blocked','cancelled')
    when 'deploying' then p_to in ('verifying','failed','blocked','rolling_back')
    when 'verifying' then p_to in ('promoted','failed','blocked','rolling_back')
    when 'failed' then p_to in ('deploying','rolling_back','cancelled')
    when 'blocked' then p_to in ('validating','ready','deploying','awaiting_approval','cancelled')
    when 'rolling_back' then p_to in ('rolled_back','failed','blocked')
    when 'rolled_back' then p_to in ('deploying','superseded','cancelled')
    when 'promoted' then p_to in ('rolling_back','superseded')
    when 'superseded' then false
    when 'cancelled' then false
    else false
  end;
$$;

create or replace function public.atlas_deployment_transition_allowed(p_from text,p_to text)
returns boolean language sql immutable set search_path='public','pg_temp' as $$
  select case p_from
    when 'queued' then p_to in ('awaiting_approval','executing','blocked','cancelled')
    when 'awaiting_approval' then p_to in ('executing','blocked','cancelled')
    when 'executing' then p_to in ('provider_complete','failed','blocked','rolling_back')
    when 'provider_complete' then p_to in ('verifying','failed','rolling_back')
    when 'verifying' then p_to in ('promoted','failed','blocked','rolling_back')
    when 'failed' then p_to in ('rolling_back','cancelled')
    when 'blocked' then p_to in ('awaiting_approval','executing','verifying','cancelled')
    when 'rolling_back' then p_to in ('rolled_back','failed','blocked')
    when 'rolled_back' then false
    when 'promoted' then p_to in ('rolling_back')
    when 'cancelled' then false
    else false
  end;
$$;

create or replace function public.enforce_frozen_release_immutability()
returns trigger language plpgsql set search_path='public','pg_temp' as $$
begin
  if tg_table_name='atlas_release_components' then
    if exists(select 1 from public.atlas_releases r where r.id=coalesce(new.release_id,old.release_id) and r.status<>'draft') then
      raise exception 'release_manifest_frozen';
    end if;
    return coalesce(new,old);
  end if;
  if old.status<>'draft' and (
    new.release_key is distinct from old.release_key or
    new.version is distinct from old.version or
    new.channel is distinct from old.channel or
    new.source_ref is distinct from old.source_ref
  ) then raise exception 'release_manifest_frozen'; end if;
  return new;
end;
$$;

create trigger atlas_releases_immutable_after_draft before update on public.atlas_releases
for each row execute function public.enforce_frozen_release_immutability();
create trigger atlas_release_components_immutable_after_draft before insert or update or delete on public.atlas_release_components
for each row execute function public.enforce_frozen_release_immutability();

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
      frozen_at=case when p_target_status='candidate' then coalesce(frozen_at,v_now) else frozen_at end,
      promoted_at=case when p_target_status='promoted' then v_now else promoted_at end,
      cancelled_at=case when p_target_status='cancelled' then v_now else cancelled_at end,
      metadata=metadata || case when p_reason is null then '{}'::jsonb else jsonb_build_object('transition_reason',left(p_reason,300)) end,
      updated_at=v_now
  where id=p_release_id;
  return jsonb_build_object('id',p_release_id,'from',r.status,'to',p_target_status,'updated_at',v_now);
end;
$$;
revoke all on function atlas_private.transition_release_internal(uuid,text,text) from public,anon;
grant execute on function atlas_private.transition_release_internal(uuid,text,text) to authenticated,service_role;

create or replace function public.atlas_transition_release(
  p_release_id uuid,
  p_target_status text,
  p_reason text default null
) returns jsonb
language sql
security invoker
set search_path='public','atlas_private','pg_temp'
as $$ select atlas_private.transition_release_internal(p_release_id,p_target_status,p_reason); $$;
revoke all on function public.atlas_transition_release(uuid,text,text) from public,anon;
grant execute on function public.atlas_transition_release(uuid,text,text) to authenticated,service_role;

create or replace function atlas_private.transition_deployment_internal(
  p_deployment_id uuid,
  p_target_status text,
  p_provider_state text default null,
  p_health_state text default null,
  p_error_code text default null,
  p_error_detail text default null
) returns jsonb
language plpgsql
security definer
set search_path='public','atlas_private','pg_temp'
as $$
declare d public.atlas_deployments; v_now timestamptz:=now(); v_actor uuid:=auth.uid(); v_role text:=coalesce(current_setting('request.jwt.claim.role',true),''); v_admin boolean:=false;
begin
  select * into d from public.atlas_deployments where id=p_deployment_id for update;
  if not found then raise exception 'deployment_not_found'; end if;
  if not public.atlas_deployment_transition_allowed(d.status,p_target_status) then raise exception 'invalid_deployment_transition'; end if;
  if p_provider_state is not null and p_provider_state not in ('not_started','running','succeeded','failed','blocked','unknown') then raise exception 'invalid_provider_state'; end if;
  if p_health_state is not null and p_health_state not in ('not_checked','checking','healthy','degraded','unhealthy','blocked') then raise exception 'invalid_health_state'; end if;
  v_admin := session_user='postgres' or v_role='service_role';
  if not v_admin then
    if d.org_id is not null then
      if v_actor is null or not public.has_identity_permission(d.org_id,'releases.deploy') then raise exception 'permission_denied'; end if;
    else
      if v_actor is null or not atlas_private.is_release_platform_admin(v_actor) then raise exception 'permission_denied'; end if;
    end if;
  end if;
  update public.atlas_deployments
  set status=p_target_status,
      provider_execution_state=coalesce(p_provider_state,provider_execution_state),
      health_state=coalesce(p_health_state,health_state),
      error_code=p_error_code,
      error_detail=case when p_error_detail is null then null else left(p_error_detail,1000) end,
      started_at=case when p_target_status in ('executing','rolling_back') then coalesce(started_at,v_now) else started_at end,
      completed_at=case when p_target_status in ('promoted','failed','blocked','rolled_back','cancelled') then v_now else completed_at end,
      verified_at=case when p_target_status in ('promoted','rolled_back') then v_now else verified_at end,
      updated_at=v_now
  where id=p_deployment_id;
  return jsonb_build_object('id',p_deployment_id,'from',d.status,'to',p_target_status,'updated_at',v_now);
end;
$$;
revoke all on function atlas_private.transition_deployment_internal(uuid,text,text,text,text,text) from public,anon;
grant execute on function atlas_private.transition_deployment_internal(uuid,text,text,text,text,text) to authenticated,service_role;

create or replace function public.atlas_transition_deployment(
  p_deployment_id uuid,
  p_target_status text,
  p_provider_state text default null,
  p_health_state text default null,
  p_error_code text default null,
  p_error_detail text default null
) returns jsonb
language sql
security invoker
set search_path='public','atlas_private','pg_temp'
as $$ select atlas_private.transition_deployment_internal(p_deployment_id,p_target_status,p_provider_state,p_health_state,p_error_code,p_error_detail); $$;
revoke all on function public.atlas_transition_deployment(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.atlas_transition_deployment(uuid,text,text,text,text,text) to authenticated,service_role;
