create or replace function public.atlas_release_requires_approval(p_release_id uuid,p_environment text,p_action text)
returns jsonb
language sql
stable
set search_path='public','pg_temp'
as $$
  with risk as (
    select
      p_environment='production' and p_action<>'reverify' and exists(
        select 1 from public.atlas_release_components c where c.release_id=p_release_id and (
          c.rollback_strategy in ('restore_snapshot','manual_only','not_reversible')
          or c.component_type='database_migration'
          or coalesce(c.metadata->>'sensitive_class','') in ('auth','secrets','permissions','rls','destructive_data','billed_infrastructure')
        )
      ) as required,
      exists(select 1 from public.atlas_release_components c where c.release_id=p_release_id and coalesce(c.metadata->>'sensitive_class','') in ('auth','secrets','permissions','rls','destructive_data')) as critical
  )
  select jsonb_build_object(
    'required',required,
    'risk_level',case when not required then 'low' when critical then 'critical' else 'high' end,
    'action',p_action
  ) from risk;
$$;

create or replace function public.atlas_rollback_policy(p_deployment_id uuid)
returns jsonb
language sql
stable
set search_path='public','pg_temp'
as $$
  with d as (select * from public.atlas_deployments where id=p_deployment_id),
  c as (select c.* from public.atlas_release_components c join d on d.release_id=c.release_id)
  select jsonb_build_object(
    'automatic_eligible',
      not exists(select 1 from c where rollback_strategy in ('manual_only','not_reversible','restore_snapshot'))
      and not exists(select 1 from c where rollback_ref is null and rollback_strategy='redeploy_previous')
      and not exists(select 1 from c where coalesce(metadata->>'sensitive_class','') in ('auth','secrets','permissions','rls','destructive_data','billed_infrastructure')),
    'approval_required',
      exists(select 1 from c where rollback_strategy in ('restore_snapshot','manual_only','not_reversible') or coalesce(metadata->>'sensitive_class','') in ('auth','secrets','permissions','rls','destructive_data','billed_infrastructure')),
    'manual_only',exists(select 1 from c where rollback_strategy in ('manual_only','not_reversible')),
    'non_reversible',exists(select 1 from c where rollback_strategy='not_reversible')
  );
$$;

create or replace function atlas_private.request_release_approval_internal(p_deployment_id uuid,p_action text,p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path='public','atlas_private','pg_temp'
as $$
declare d public.atlas_deployments; r public.atlas_releases; v_actor uuid:=auth.uid(); v_role text:=coalesce(current_setting('request.jwt.claim.role',true),''); v_admin boolean:=false; v_policy jsonb; v_id uuid; v_perm text; v_action text;
begin
  if p_action not in ('promote','rollback') then raise exception 'invalid_release_approval_action'; end if;
  select * into d from public.atlas_deployments where id=p_deployment_id;
  if not found then raise exception 'deployment_not_found'; end if;
  select * into r from public.atlas_releases where id=d.release_id;
  if not found then raise exception 'release_not_found'; end if;
  if r.org_id is null then raise exception 'platform_approval_context_required'; end if;
  v_perm:=case when p_action='promote' then 'releases.promote' else 'releases.rollback' end;
  v_action:='release.'||p_action;
  v_admin:=session_user='postgres' or v_role='service_role';
  if not v_admin then
    if v_actor is null or not public.has_identity_permission(r.org_id,v_perm) or not public.has_identity_permission(r.org_id,'approvals.manage') then raise exception 'permission_denied'; end if;
  end if;
  v_policy:=public.atlas_release_requires_approval(r.id,d.environment,p_action);
  if not (v_policy->>'required')::boolean then raise exception 'approval_not_required'; end if;
  if v_actor is null then
    select requested_by into v_actor from public.atlas_approvals where org_id=r.org_id order by requested_at desc limit 1;
    if v_actor is null then select user_id into v_actor from public.organization_members where org_id=r.org_id and status='active' order by case role when 'owner' then 0 when 'admin' then 1 else 2 end limit 1; end if;
  end if;
  if v_actor is null then raise exception 'approval_requester_required'; end if;
  insert into public.atlas_approvals(org_id,subject_type,subject_id,action,risk_level,requested_by,status,reason,metadata)
  values(r.org_id,'deployment',d.id::text,v_action,v_policy->>'risk_level',v_actor,'pending',left(coalesce(p_reason,'Release control approval requested'),500),jsonb_build_object('release_id',r.id,'deployment_id',d.id,'environment',d.environment,'contains_personal_data',false))
  returning id into v_id;
  update public.atlas_deployments set approval_id=v_id,updated_at=now() where id=d.id;
  update public.atlas_releases set approval_id=v_id,updated_at=now() where id=r.id;
  return v_id;
end;
$$;
revoke all on function atlas_private.request_release_approval_internal(uuid,text,text) from public,anon;
grant execute on function atlas_private.request_release_approval_internal(uuid,text,text) to authenticated,service_role;

create or replace function public.atlas_request_release_approval(p_deployment_id uuid,p_action text,p_reason text default null)
returns uuid language sql security invoker set search_path='public','atlas_private','pg_temp'
as $$ select atlas_private.request_release_approval_internal(p_deployment_id,p_action,p_reason); $$;
revoke all on function public.atlas_request_release_approval(uuid,text,text) from public,anon;
grant execute on function public.atlas_request_release_approval(uuid,text,text) to authenticated,service_role;

create or replace function atlas_private.promote_deployment_internal(p_deployment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public','atlas_private','pg_temp'
as $$
declare d public.atlas_deployments; r public.atlas_releases; v_policy jsonb; v_now timestamptz:=now(); v_actor uuid:=auth.uid(); v_role text:=coalesce(current_setting('request.jwt.claim.role',true),''); v_admin boolean:=false; v_action text;
begin
  select * into d from public.atlas_deployments where id=p_deployment_id for update;
  if not found then raise exception 'deployment_not_found'; end if;
  select * into r from public.atlas_releases where id=d.release_id for update;
  if not found then raise exception 'release_not_found'; end if;
  v_admin:=session_user='postgres' or v_role='service_role';
  if not v_admin then
    if r.org_id is not null then
      if v_actor is null or not public.has_identity_permission(r.org_id,'releases.promote') then raise exception 'permission_denied'; end if;
    else
      if v_actor is null or not atlas_private.is_release_platform_admin(v_actor) then raise exception 'permission_denied'; end if;
    end if;
  end if;
  if d.status<>'verifying' then raise exception 'deployment_not_verifying'; end if;
  if r.status<>'verifying' then raise exception 'release_not_verifying'; end if;
  if not public.atlas_deployment_promotable(d.id) then raise exception 'deployment_gates_not_satisfied'; end if;
  v_action:=case when d.deployment_kind='reverify' then 'reverify' else 'promote' end;
  v_policy:=public.atlas_release_requires_approval(r.id,d.environment,v_action);
  if (v_policy->>'required')::boolean then
    if not exists(
      select 1 from public.atlas_approvals a
      where a.id=d.approval_id and a.status='approved' and a.expires_at>now()
        and a.subject_type='deployment' and a.subject_id=d.id::text and a.action='release.promote'
    ) then raise exception 'approved_deployment_approval_required'; end if;
  end if;
  if d.environment='production' then
    update public.atlas_releases set status='superseded',updated_at=v_now
    where channel='production' and status='promoted' and id<>r.id and org_id is not distinct from r.org_id;
  end if;
  update public.atlas_deployments set status='promoted',verified_at=v_now,completed_at=v_now,updated_at=v_now where id=d.id;
  update public.atlas_releases set status='promoted',promoted_at=v_now,updated_at=v_now where id=r.id;
  return jsonb_build_object('deployment_id',d.id,'release_id',r.id,'status','promoted','verified_at',v_now);
end;
$$;
revoke all on function atlas_private.promote_deployment_internal(uuid) from public,anon;
grant execute on function atlas_private.promote_deployment_internal(uuid) to authenticated,service_role;

create or replace function public.atlas_promote_deployment(p_deployment_id uuid)
returns jsonb language sql security invoker set search_path='public','atlas_private','pg_temp'
as $$ select atlas_private.promote_deployment_internal(p_deployment_id); $$;
revoke all on function public.atlas_promote_deployment(uuid) from public,anon;
grant execute on function public.atlas_promote_deployment(uuid) to authenticated,service_role;

create or replace function atlas_private.request_deployment_rollback_internal(p_deployment_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path='public','atlas_private','pg_temp'
as $$
declare d public.atlas_deployments; r public.atlas_releases; p jsonb; v_now timestamptz:=now(); v_actor uuid:=auth.uid(); v_role text:=coalesce(current_setting('request.jwt.claim.role',true),''); v_admin boolean:=false; v_valid_approval boolean:=false;
begin
  select * into d from public.atlas_deployments where id=p_deployment_id for update;
  if not found then raise exception 'deployment_not_found'; end if;
  select * into r from public.atlas_releases where id=d.release_id for update;
  if not found then raise exception 'release_not_found'; end if;
  v_admin:=session_user='postgres' or v_role='service_role';
  if not v_admin then
    if r.org_id is not null then
      if v_actor is null or not public.has_identity_permission(r.org_id,'releases.rollback') then raise exception 'permission_denied'; end if;
    else
      if v_actor is null or not atlas_private.is_release_platform_admin(v_actor) then raise exception 'permission_denied'; end if;
    end if;
  end if;
  p:=public.atlas_rollback_policy(d.id);
  if (p->>'non_reversible')::boolean then
    update public.atlas_deployments set error_code='rollback_not_reversible',error_detail='Forward-fix or explicit restoration strategy required',metadata=metadata||jsonb_build_object('rollback_request_state','blocked','rollback_reason',left(coalesce(p_reason,''),300)),updated_at=v_now where id=d.id;
    return jsonb_build_object('deployment_id',d.id,'status',d.status,'rollback_request_state','blocked','manual_only',true,'reason','rollback_not_reversible');
  end if;
  if d.approval_id is not null then
    select exists(select 1 from public.atlas_approvals a where a.id=d.approval_id and a.status='approved' and a.expires_at>now() and a.subject_type='deployment' and a.subject_id=d.id::text and a.action='release.rollback') into v_valid_approval;
  end if;
  if (p->>'approval_required')::boolean and not v_valid_approval then
    update public.atlas_deployments set metadata=metadata||jsonb_build_object('rollback_request_state','awaiting_approval','rollback_reason',left(coalesce(p_reason,''),300)),updated_at=v_now where id=d.id;
    return jsonb_build_object('deployment_id',d.id,'status',d.status,'rollback_request_state','awaiting_approval','approval_required',true);
  end if;
  if not public.atlas_deployment_transition_allowed(d.status,'rolling_back') then raise exception 'rollback_transition_not_allowed'; end if;
  if not public.atlas_release_transition_allowed(r.status,'rolling_back') then raise exception 'release_rollback_transition_not_allowed'; end if;
  update public.atlas_deployments set status='rolling_back',provider_execution_state='running',health_state='checking',error_code=null,error_detail=null,metadata=metadata||jsonb_build_object('rollback_request_state','authorized','rollback_reason',left(coalesce(p_reason,''),300)),started_at=coalesce(started_at,v_now),updated_at=v_now where id=d.id;
  update public.atlas_releases set status='rolling_back',updated_at=v_now where id=r.id;
  return jsonb_build_object('deployment_id',d.id,'status','rolling_back','automatic_eligible',(p->>'automatic_eligible')::boolean);
end;
$$;
revoke all on function atlas_private.request_deployment_rollback_internal(uuid,text) from public,anon;
grant execute on function atlas_private.request_deployment_rollback_internal(uuid,text) to authenticated,service_role;

create or replace function public.atlas_request_deployment_rollback(p_deployment_id uuid,p_reason text)
returns jsonb language sql security invoker set search_path='public','atlas_private','pg_temp'
as $$ select atlas_private.request_deployment_rollback_internal(p_deployment_id,p_reason); $$;
revoke all on function public.atlas_request_deployment_rollback(uuid,text) from public,anon;
grant execute on function public.atlas_request_deployment_rollback(uuid,text) to authenticated,service_role;

create or replace function atlas_private.mark_rollback_verified_internal(p_deployment_id uuid,p_verification_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public','atlas_private','pg_temp'
as $$
declare d public.atlas_deployments; r public.atlas_releases; v public.atlas_runtime_verification_runs; v_now timestamptz:=now();
begin
  select * into d from public.atlas_deployments where id=p_deployment_id for update;
  if not found then raise exception 'deployment_not_found'; end if;
  if d.status<>'rolling_back' or d.provider_execution_state<>'succeeded' then raise exception 'rollback_provider_not_complete'; end if;
  select * into v from public.atlas_runtime_verification_runs where id=p_verification_run_id;
  if not found or v.status<>'passed' or v.environment<>d.environment or v.created_at<coalesce(d.started_at,d.created_at) then raise exception 'rollback_verification_not_passed'; end if;
  select * into r from public.atlas_releases where id=d.release_id for update;
  if r.status<>'rolling_back' then raise exception 'release_not_rolling_back'; end if;
  update public.atlas_deployments set status='rolled_back',health_state='healthy',verified_at=v_now,completed_at=v_now,updated_at=v_now where id=d.id;
  update public.atlas_releases set status='rolled_back',updated_at=v_now where id=d.release_id;
  return jsonb_build_object('deployment_id',d.id,'status','rolled_back','verification_run_id',v.id,'verified_at',v_now);
end;
$$;
revoke all on function atlas_private.mark_rollback_verified_internal(uuid,uuid) from public,anon,authenticated;
grant execute on function atlas_private.mark_rollback_verified_internal(uuid,uuid) to service_role;

create or replace function public.atlas_mark_rollback_verified(p_deployment_id uuid,p_verification_run_id uuid)
returns jsonb language sql security invoker set search_path='public','atlas_private','pg_temp'
as $$ select atlas_private.mark_rollback_verified_internal(p_deployment_id,p_verification_run_id); $$;
revoke all on function public.atlas_mark_rollback_verified(uuid,uuid) from public,anon,authenticated;
grant execute on function public.atlas_mark_rollback_verified(uuid,uuid) to service_role;
