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
    set status='expired',updated_at=now(),evaluated_at=coalesce(g.evaluated_at,now()),error_code=coalesce(g.error_code,'gate_evidence_expired')
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
