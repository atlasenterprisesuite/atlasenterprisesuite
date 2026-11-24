create or replace function atlas_private.release_posture_internal()
returns jsonb
language plpgsql
security definer
set search_path='public','cron','pg_temp'
as $$
declare
  v_stuck int:=0; v_expired int:=0; v_duplicate_promoted_scopes int:=0; v_bad_manifest int:=0;
  v_p0 int:=0; v_p1 int:=0; v_cron boolean:=false;
begin
  select count(*) into v_stuck
  from public.atlas_deployments
  where status in ('executing','provider_complete','verifying','rolling_back')
    and updated_at < now()-interval '30 minutes';

  select count(*) into v_expired
  from public.atlas_deployment_gates g
  join public.atlas_deployments d on d.id=g.deployment_id
  where g.required=true
    and g.status not in ('passed','waived','failed','blocked','expired')
    and g.expires_at is not null and g.expires_at<=now()
    and d.status not in ('promoted','rolled_back','cancelled');

  select count(*) into v_duplicate_promoted_scopes
  from (
    select coalesce(org_id::text,'__platform__') scope_key,channel,count(*) n
    from public.atlas_releases
    where status='promoted'
    group by coalesce(org_id::text,'__platform__'),channel
    having count(*)>1
  ) x;

  select count(*) into v_bad_manifest
  from public.atlas_releases r
  where r.status='promoted' and r.manifest_hash<>public.atlas_release_manifest_hash(r.id);

  select count(*) filter(where severity='P0' and status<>'resolved'),
         count(*) filter(where severity='P1' and status<>'resolved')
  into v_p0,v_p1 from public.atlas_incidents;

  select exists(select 1 from cron.job where jobname='atlas-release-control-verification-15m' and active=true) into v_cron;

  return jsonb_build_object(
    'service','atlas-release-control',
    'status',case
      when v_bad_manifest>0 or v_duplicate_promoted_scopes>0 then 'failed'
      when v_stuck>0 or v_expired>0 or v_p0>0 or v_p1>0 then 'needs_attention'
      else 'operational' end,
    'stuck_deployments',v_stuck,
    'expired_required_gates',v_expired,
    'duplicate_promoted_scopes',v_duplicate_promoted_scopes,
    'manifest_mismatches',v_bad_manifest,
    'open_p0',v_p0,
    'open_p1',v_p1,
    'verification_cron_active',v_cron,
    'checked_at',now()
  );
end;
$$;
revoke all on function atlas_private.release_posture_internal() from public,anon,authenticated;
grant execute on function atlas_private.release_posture_internal() to service_role;

create or replace function public.atlas_release_posture()
returns jsonb
language sql
security invoker
set search_path='public','atlas_private','pg_temp'
as $$ select atlas_private.release_posture_internal(); $$;
revoke all on function public.atlas_release_posture() from public,anon,authenticated;
grant execute on function public.atlas_release_posture() to service_role;

create or replace function atlas_private.run_release_verification_internal()
returns uuid
language plpgsql
security definer
set search_path='public','atlas_private','extensions','cron','pg_temp'
set statement_timeout='30s'
as $$
declare
  v_started timestamptz:=clock_timestamp(); v_posture jsonb; v_id uuid; v_ok boolean; v_checks jsonb; v_expired int:=0;
begin
  with changed as (
    update public.atlas_deployment_gates g
    set status='expired',updated_at=now(),evaluated_at=coalesce(evaluated_at,now()),error_code=coalesce(error_code,'gate_evidence_expired')
    from public.atlas_deployments d
    where d.id=g.deployment_id
      and g.required=true
      and g.status in ('pending','running','passed')
      and g.expires_at is not null and g.expires_at<=now()
      and d.status not in ('promoted','rolled_back','cancelled')
    returning g.id
  ) select count(*) into v_expired from changed;

  v_posture:=atlas_private.release_posture_internal();
  v_ok:=coalesce(v_posture->>'status','failed')<>'failed';
  v_checks:=jsonb_build_object('posture',v_posture,'expired_gates_marked',v_expired,'contains_personal_data',false);

  insert into public.atlas_runtime_verification_runs(
    verification_type,target_service,target_version,environment,status,started_at,completed_at,duration_ms,
    provider,provider_state,storage_state,checks,metadata,error_code,error_detail
  ) values (
    'release-control-production','atlas-release-control','1','production',case when v_ok then 'passed' else 'failed' end,
    v_started,clock_timestamp(),greatest(0,round(extract(epoch from clock_timestamp()-v_started)*1000)::int),
    'supabase-native',v_posture->>'status','configured',v_checks,
    jsonb_build_object('contains_personal_data',false,'completion_gate',false),
    case when v_ok then null else 'release_control_posture_failed' end,
    case when v_ok then null else 'Release-control posture contains blocking structural failure' end
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function atlas_private.run_release_verification_internal() from public,anon,authenticated;
grant execute on function atlas_private.run_release_verification_internal() to service_role;

create or replace function public.atlas_run_release_verification()
returns uuid
language sql
security invoker
set search_path='public','atlas_private','pg_temp'
as $$ select atlas_private.run_release_verification_internal(); $$;
revoke all on function public.atlas_run_release_verification() from public,anon,authenticated;
grant execute on function public.atlas_run_release_verification() to service_role;

do $$
declare j bigint;
begin
  for j in select jobid from cron.job where jobname='atlas-release-control-verification-15m' loop
    perform cron.unschedule(j);
  end loop;
  perform cron.schedule('atlas-release-control-verification-15m','5,20,35,50 * * * *','select public.atlas_run_release_verification();');
end $$;
