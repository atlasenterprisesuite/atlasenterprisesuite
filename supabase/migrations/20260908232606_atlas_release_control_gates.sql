create or replace function public.atlas_default_deployment_gates(p_environment text)
returns jsonb language sql immutable set search_path='public','pg_temp' as $$
  select case p_environment
    when 'production' then '[
      {"key":"artifact_integrity","type":"integrity","required":true},
      {"key":"release_manifest_integrity","type":"integrity","required":true},
      {"key":"migration_validation","type":"migration","required":true},
      {"key":"security_advisor","type":"security","required":true},
      {"key":"runtime_readiness","type":"runtime","required":true},
      {"key":"public_health","type":"health","required":true},
      {"key":"observability_critical_incidents","type":"observability","required":true},
      {"key":"deployment_evidence","type":"evidence","required":true},
      {"key":"approval_policy","type":"approval","required":true},
      {"key":"post_deploy_verification","type":"runtime","required":true},
      {"key":"github_ci","type":"provider","required":false}
    ]'::jsonb
    when 'staging' then '[
      {"key":"artifact_integrity","type":"integrity","required":true},
      {"key":"release_manifest_integrity","type":"integrity","required":true},
      {"key":"migration_validation","type":"migration","required":true},
      {"key":"runtime_readiness","type":"runtime","required":true},
      {"key":"deployment_evidence","type":"evidence","required":true}
    ]'::jsonb
    when 'development' then '[
      {"key":"artifact_integrity","type":"integrity","required":true},
      {"key":"release_manifest_integrity","type":"integrity","required":true}
    ]'::jsonb
    else null
  end;
$$;

create or replace function atlas_private.create_deployment_internal(p_release_id uuid,p_environment text,p_kind text default 'promote')
returns uuid
language plpgsql
security definer
set search_path='public','atlas_private','pg_temp'
as $$
declare r public.atlas_releases; v_id uuid; v_attempt int; g jsonb; v_actor uuid:=auth.uid(); v_role text:=coalesce(current_setting('request.jwt.claim.role',true),''); v_admin boolean:=false;
begin
  if p_environment not in ('development','staging','production') then raise exception 'invalid_environment'; end if;
  if p_kind not in ('promote','rollback','reverify') then raise exception 'invalid_deployment_kind'; end if;
  select * into r from public.atlas_releases where id=p_release_id;
  if not found then raise exception 'release_not_found'; end if;
  if r.status not in ('candidate','validating','ready','failed','blocked','rolled_back','promoted') then raise exception 'release_not_deployable'; end if;
  if r.frozen_at is null or r.manifest_hash=repeat('0',64) then raise exception 'release_not_frozen'; end if;
  if r.channel='production' and p_environment<>'production' and p_kind='promote' then raise exception 'production_release_environment_mismatch'; end if;
  v_admin:=session_user='postgres' or v_role='service_role';
  if not v_admin then
    if r.org_id is not null then
      if v_actor is null or not public.has_identity_permission(r.org_id,'releases.deploy') then raise exception 'permission_denied'; end if;
    else
      if v_actor is null or not atlas_private.is_release_platform_admin(v_actor) then raise exception 'permission_denied'; end if;
    end if;
  end if;
  select coalesce(max(attempt),0)+1 into v_attempt from public.atlas_deployments where release_id=p_release_id and environment=p_environment and deployment_kind=p_kind;
  insert into public.atlas_deployments(release_id,org_id,environment,deployment_kind,attempt,requested_by)
  values(p_release_id,r.org_id,p_environment,p_kind,v_attempt,v_actor) returning id into v_id;
  for g in select * from jsonb_array_elements(public.atlas_default_deployment_gates(p_environment)) loop
    insert into public.atlas_deployment_gates(deployment_id,gate_key,gate_type,required)
    values(v_id,g->>'key',g->>'type',coalesce((g->>'required')::boolean,true));
  end loop;
  return v_id;
end;
$$;
revoke all on function atlas_private.create_deployment_internal(uuid,text,text) from public,anon;
grant execute on function atlas_private.create_deployment_internal(uuid,text,text) to authenticated,service_role;

create or replace function public.atlas_create_deployment(p_release_id uuid,p_environment text,p_kind text default 'promote')
returns uuid language sql security invoker set search_path='public','atlas_private','pg_temp'
as $$ select atlas_private.create_deployment_internal(p_release_id,p_environment,p_kind); $$;
revoke all on function public.atlas_create_deployment(uuid,text,text) from public,anon;
grant execute on function public.atlas_create_deployment(uuid,text,text) to authenticated,service_role;

create or replace function public.atlas_gate_status_summary(p_deployment_id uuid)
returns jsonb
language sql
stable
set search_path='public','pg_temp'
as $$
  select jsonb_build_object(
    'deployment_id',p_deployment_id,
    'total',count(*),
    'required',count(*) filter(where required),
    'passed',count(*) filter(where status='passed'),
    'waived',count(*) filter(where status='waived'),
    'failed',count(*) filter(where status='failed'),
    'blocked',count(*) filter(where status='blocked'),
    'expired',count(*) filter(where status='expired'),
    'pending',count(*) filter(where status in ('pending','running'))
  )
  from public.atlas_deployment_gates where deployment_id=p_deployment_id;
$$;

create or replace function atlas_private.set_deployment_gate_internal(
  p_deployment_id uuid,p_gate_key text,p_status text,p_verification_run_id uuid default null,
  p_approval_id uuid default null,p_evidence_ref text default null,p_error_code text default null,p_expires_at timestamptz default null
) returns void
language plpgsql
security definer
set search_path='public','atlas_private','pg_temp'
as $$
begin
  if p_status not in ('pending','running','passed','failed','blocked','waived','expired') then raise exception 'invalid_gate_status'; end if;
  if p_status='waived' then
    if p_approval_id is null then raise exception 'gate_waiver_requires_approval'; end if;
    if not exists(select 1 from public.atlas_approvals a where a.id=p_approval_id and a.status='approved' and (a.expires_at is null or a.expires_at>now())) then
      raise exception 'gate_waiver_requires_valid_approval';
    end if;
  end if;
  update public.atlas_deployment_gates
  set status=p_status,verification_run_id=p_verification_run_id,approval_id=p_approval_id,evidence_ref=case when p_evidence_ref is null then null else left(p_evidence_ref,500) end,
      error_code=p_error_code,expires_at=p_expires_at,evaluated_at=now(),updated_at=now()
  where deployment_id=p_deployment_id and gate_key=p_gate_key;
  if not found then raise exception 'deployment_gate_not_found'; end if;
end;
$$;
revoke all on function atlas_private.set_deployment_gate_internal(uuid,text,text,uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function atlas_private.set_deployment_gate_internal(uuid,text,text,uuid,uuid,text,text,timestamptz) to service_role;

create or replace function public.atlas_set_deployment_gate(
  p_deployment_id uuid,p_gate_key text,p_status text,p_verification_run_id uuid default null,
  p_approval_id uuid default null,p_evidence_ref text default null,p_error_code text default null,p_expires_at timestamptz default null
) returns void
language sql
security invoker
set search_path='public','atlas_private','pg_temp'
as $$ select atlas_private.set_deployment_gate_internal(p_deployment_id,p_gate_key,p_status,p_verification_run_id,p_approval_id,p_evidence_ref,p_error_code,p_expires_at); $$;
revoke all on function public.atlas_set_deployment_gate(uuid,text,text,uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.atlas_set_deployment_gate(uuid,text,text,uuid,uuid,text,text,timestamptz) to service_role;

create or replace function atlas_private.evaluate_deployment_gates_internal(p_deployment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public','atlas_private','extensions','pg_temp'
set statement_timeout='30s'
as $$
declare
 d public.atlas_deployments; r public.atlas_releases; v_manifest text; v_p0 int; v_p1 int;
 v_gate_verification uuid; v_vstatus text; v_venv text; v_vcreated timestamptz;
 v_required_failed int; v_required_blocked int; v_required_pending int; v_needs_approval boolean; v_approval_ok boolean;
begin
  select * into d from public.atlas_deployments where id=p_deployment_id for update;
  if not found then raise exception 'deployment_not_found'; end if;
  select * into r from public.atlas_releases where id=d.release_id;
  if not found then raise exception 'release_not_found'; end if;

  v_manifest:=public.atlas_release_manifest_hash(r.id);
  perform atlas_private.set_deployment_gate_internal(d.id,'release_manifest_integrity',case when v_manifest=r.manifest_hash then 'passed' else 'failed' end,null,null,r.manifest_hash,case when v_manifest<>r.manifest_hash then 'manifest_hash_mismatch' end,null);

  perform atlas_private.set_deployment_gate_internal(d.id,'artifact_integrity',case when not exists(
    select 1 from public.atlas_release_components c where c.release_id=r.id and (c.artifact_sha256 !~ '^[0-9a-f]{64}$' or c.artifact_sha256=repeat('0',64))
  ) then 'passed' else 'failed' end,null,null,r.manifest_hash,case when exists(
    select 1 from public.atlas_release_components c where c.release_id=r.id and (c.artifact_sha256 !~ '^[0-9a-f]{64}$' or c.artifact_sha256=repeat('0',64))
  ) then 'artifact_integrity_failed' end,null);

  if exists(select 1 from public.atlas_deployment_gates where deployment_id=d.id and gate_key='migration_validation') then
    perform atlas_private.set_deployment_gate_internal(d.id,'migration_validation',case when not exists(
      select 1 from public.atlas_release_components c where c.release_id=r.id and c.requires_migration=true and (
        c.migration_ref is null or (c.rollback_strategy='not_reversible' and d.environment='production' and d.approval_id is null)
      )
    ) then 'passed' else 'blocked' end,null,d.approval_id,null,case when exists(
      select 1 from public.atlas_release_components c where c.release_id=r.id and c.requires_migration=true and c.migration_ref is null
    ) then 'migration_ref_missing' else case when exists(
      select 1 from public.atlas_release_components c where c.release_id=r.id and c.requires_migration=true and c.rollback_strategy='not_reversible' and d.environment='production' and d.approval_id is null
    ) then 'non_reversible_migration_requires_approval' end end,null);
  end if;

  if exists(select 1 from public.atlas_deployment_gates where deployment_id=d.id and gate_key='observability_critical_incidents') then
    select count(*) filter(where severity='P0' and status<>'resolved'),count(*) filter(where severity='P1' and status<>'resolved') into v_p0,v_p1 from public.atlas_incidents;
    perform atlas_private.set_deployment_gate_internal(d.id,'observability_critical_incidents',case when d.environment='production' and (v_p0>0 or v_p1>0) then 'blocked' else 'passed' end,null,null,null,case when v_p0>0 or v_p1>0 then 'critical_incident_open' end,now()+interval '10 minutes');
  end if;

  if exists(select 1 from public.atlas_deployment_gates where deployment_id=d.id and gate_key='approval_policy') then
    select d.environment='production' and exists(
      select 1 from public.atlas_release_components c where c.release_id=r.id and (
        c.rollback_strategy in ('restore_snapshot','manual_only','not_reversible') or c.component_type='database_migration' or coalesce(c.metadata->>'sensitive_class','') in ('auth','secrets','permissions','rls','destructive_data','billed_infrastructure')
      )
    ) into v_needs_approval;
    v_approval_ok:=not v_needs_approval;
    if v_needs_approval and d.approval_id is not null then
      select exists(select 1 from public.atlas_approvals a where a.id=d.approval_id and a.status='approved' and (a.expires_at is null or a.expires_at>now())) into v_approval_ok;
    end if;
    perform atlas_private.set_deployment_gate_internal(d.id,'approval_policy',case when v_approval_ok then 'passed' else 'blocked' end,null,d.approval_id,null,case when not v_approval_ok then 'approval_missing_or_expired' end,null);
  end if;

  if exists(select 1 from public.atlas_deployment_gates where deployment_id=d.id and gate_key='runtime_readiness') then
    select verification_run_id into v_gate_verification from public.atlas_deployment_gates where deployment_id=d.id and gate_key='runtime_readiness';
    v_vstatus:=null; v_venv:=null; v_vcreated:=null;
    if v_gate_verification is not null then
      select status,environment,created_at into v_vstatus,v_venv,v_vcreated from public.atlas_runtime_verification_runs where id=v_gate_verification;
    end if;
    perform atlas_private.set_deployment_gate_internal(d.id,'runtime_readiness',case when v_vstatus='passed' and v_venv=d.environment and v_vcreated>=now()-interval '30 minutes' then 'passed' else 'pending' end,v_gate_verification,null,null,case when v_gate_verification is null then 'runtime_verification_missing' when v_vstatus<>'passed' or v_venv<>d.environment or v_vcreated<now()-interval '30 minutes' then 'runtime_verification_stale_or_invalid' end,case when v_gate_verification is not null then v_vcreated+interval '30 minutes' end);
  end if;

  if exists(select 1 from public.atlas_deployment_gates where deployment_id=d.id and gate_key='deployment_evidence') then
    perform atlas_private.set_deployment_gate_internal(d.id,'deployment_evidence',case when d.provider_execution_state='succeeded' and coalesce(d.metadata->>'provider_evidence_ref','')<>'' then 'passed' else 'pending' end,null,null,d.metadata->>'provider_evidence_ref',case when d.provider_execution_state='succeeded' and coalesce(d.metadata->>'provider_evidence_ref','')='' then 'deployment_evidence_missing' end,null);
  end if;

  if exists(select 1 from public.atlas_deployment_gates where deployment_id=d.id and gate_key='post_deploy_verification') then
    select verification_run_id into v_gate_verification from public.atlas_deployment_gates where deployment_id=d.id and gate_key='post_deploy_verification';
    v_vstatus:=null; v_venv:=null; v_vcreated:=null;
    if v_gate_verification is not null then
      select status,environment,created_at into v_vstatus,v_venv,v_vcreated from public.atlas_runtime_verification_runs where id=v_gate_verification;
    end if;
    perform atlas_private.set_deployment_gate_internal(d.id,'post_deploy_verification',case when d.provider_execution_state='succeeded' and d.health_state='healthy' and v_vstatus='passed' and v_venv=d.environment and v_vcreated>=now()-interval '30 minutes' then 'passed' else 'pending' end,v_gate_verification,null,null,case when d.provider_execution_state='succeeded' and v_gate_verification is null then 'post_deploy_verification_missing' end,case when v_gate_verification is not null then v_vcreated+interval '30 minutes' end);
  end if;

  if exists(select 1 from public.atlas_deployment_gates where deployment_id=d.id and gate_key='github_ci') then
    update public.atlas_deployment_gates set required=coalesce((d.metadata->>'github_ci_required')::boolean,false),updated_at=now() where deployment_id=d.id and gate_key='github_ci';
    perform atlas_private.set_deployment_gate_internal(d.id,'github_ci',case when coalesce(d.metadata->>'github_ci_status','')='passed' then 'passed' when coalesce((d.metadata->>'github_ci_required')::boolean,false) then 'blocked' else 'pending' end,null,null,d.metadata->>'github_evidence_ref',case when coalesce((d.metadata->>'github_ci_required')::boolean,false) and coalesce(d.metadata->>'github_ci_status','')<>'passed' then 'github_ci_unavailable_or_unverified' end,null);
  end if;

  select count(*) filter(where required and status in ('failed','expired')),count(*) filter(where required and status='blocked'),count(*) filter(where required and status in ('pending','running'))
  into v_required_failed,v_required_blocked,v_required_pending
  from public.atlas_deployment_gates where deployment_id=d.id;
  return jsonb_build_object('deployment_id',d.id,'failed',v_required_failed,'blocked',v_required_blocked,'pending',v_required_pending,'evaluated_at',now());
end;
$$;
revoke all on function atlas_private.evaluate_deployment_gates_internal(uuid) from public,anon,authenticated;
grant execute on function atlas_private.evaluate_deployment_gates_internal(uuid) to service_role;

create or replace function public.atlas_evaluate_deployment_gates(p_deployment_id uuid)
returns jsonb language sql security invoker set search_path='public','atlas_private','pg_temp'
as $$ select atlas_private.evaluate_deployment_gates_internal(p_deployment_id); $$;
revoke all on function public.atlas_evaluate_deployment_gates(uuid) from public,anon,authenticated;
grant execute on function public.atlas_evaluate_deployment_gates(uuid) to service_role;

create or replace function public.atlas_deployment_promotable(p_deployment_id uuid)
returns boolean
language sql
stable
set search_path='public','pg_temp'
as $$
  select coalesce(
    d.provider_execution_state='succeeded'
    and d.health_state='healthy'
    and not exists(select 1 from public.atlas_deployment_gates g where g.deployment_id=d.id and g.required=true and g.status not in ('passed','waived'))
    and not exists(
      select 1 from public.atlas_deployment_gates g
      left join public.atlas_approvals a on a.id=g.approval_id
      where g.deployment_id=d.id and g.status='waived' and (g.approval_id is null or a.status<>'approved' or a.expires_at<=now())
    ),false)
  from public.atlas_deployments d where d.id=p_deployment_id;
$$;
