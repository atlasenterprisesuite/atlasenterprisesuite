create or replace function public.atlas_run_release_e2e()
returns uuid
language plpgsql
security definer
set search_path='public','extensions','cron','pg_temp'
set statement_timeout='45s'
as $$
declare
  v_started timestamptz:=clock_timestamp();
  v_checks jsonb:='{}'::jsonb;
  v_all boolean:=false;
  v_id uuid;
  v_tables int; v_permissions int; v_promoted int; v_baseline int; v_cron boolean; v_bad_gates int; v_dupes int;
  v_release_rule boolean; v_deploy_rule boolean; v_manifest boolean; v_gate boolean; v_audit boolean; v_timeline boolean;
  v_traces int; v_metrics int; v_ready_status int; v_private_status int; v_health_status int; v_health jsonb:='{}'::jsonb; v_health_text text;
  v_auth boolean; v_rollback boolean; v_advisor boolean; v_approval boolean; v_history boolean; v_baseline_id uuid;
  v_role text:=coalesce(current_setting('request.jwt.claim.role',true),'');
begin
  if session_user <> 'postgres' and v_role <> 'service_role' then raise exception 'service_role_required'; end if;

  select count(*) into v_tables
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('atlas_releases','atlas_release_components','atlas_deployments','atlas_deployment_gates') and c.relrowsecurity=true;

  select count(*) into v_permissions from public.identity_permissions
  where code in ('releases.read','releases.create','releases.manage','releases.deploy','releases.promote','releases.rollback','releases.waive_gate');

  select count(*) into v_promoted from public.atlas_releases where channel='production' and status='promoted';
  select count(*),min(id) into v_baseline,v_baseline_id from public.atlas_releases where channel='production' and status='promoted' and metadata->>'baseline'='true';
  select exists(select 1 from cron.job where jobname='atlas-release-control-verification-15m' and active=true and schedule='5,20,35,50 * * * *') into v_cron;
  select count(*) into v_bad_gates from public.atlas_deployment_gates g join public.atlas_deployments d on d.id=g.deployment_id where d.status='promoted' and g.required=true and g.status not in ('passed','waived');
  select count(*) into v_dupes from (select release_id,environment,deployment_kind,attempt,count(*) from public.atlas_deployments group by 1,2,3,4 having count(*)>1) x;

  select public.atlas_release_transition_allowed('draft','candidate') and not public.atlas_release_transition_allowed('draft','promoted') into v_release_rule;
  select public.atlas_deployment_transition_allowed('provider_complete','verifying') and not public.atlas_deployment_transition_allowed('queued','promoted') into v_deploy_rule;
  select exists(select 1 from public.atlas_releases r where r.id=v_baseline_id and r.manifest_hash=public.atlas_release_manifest_hash(r.id) and r.manifest_hash<>repeat('0',64)) into v_manifest;
  select exists(select 1 from public.atlas_deployment_gates g join public.atlas_deployments d on d.id=g.deployment_id where d.release_id=v_baseline_id) into v_gate;
  select count(*)>=3 into v_audit from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname in ('atlas_releases','atlas_deployments','atlas_deployment_gates') and not t.tgisinternal and t.tgenabled<>'D' and t.tgname like '%audit%';
  select coalesce(pg_get_functiondef(p.oid) ilike '%atlas_releases%' and pg_get_functiondef(p.oid) ilike '%atlas_deployments%',false) into v_timeline
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='list_governance_timeline' limit 1;

  select count(*) into v_traces from public.atlas_trace_spans where module='atlas-release-control' and occurred_at>=now()-interval '90 minutes';
  select count(*) into v_metrics from public.atlas_operational_metrics where module='atlas-release-control' and recorded_at>=now()-interval '90 minutes';

  select exists(select 1 from public.atlas_runtime_verification_runs where verification_type='release-control-auth-contract' and target_service='atlas-release-control' and status='passed' and created_at>=now()-interval '90 minutes') into v_auth;
  select exists(select 1 from public.atlas_runtime_verification_runs where verification_type='release-control-rollback-contract' and target_service='atlas-release-control' and status='passed' and created_at>=now()-interval '90 minutes') into v_rollback;
  select exists(select 1 from public.atlas_runtime_verification_runs where verification_type='release-control-advisor-contract' and target_service='atlas-release-control' and status='passed' and created_at>=now()-interval '90 minutes') into v_advisor;

  select coalesce((public.atlas_release_requires_approval(v_baseline_id,'production','reverify')->>'required')::boolean=false,false)
         and coalesce((public.atlas_release_requires_approval(v_baseline_id,'production','promote')->>'required')::boolean=true,false)
    into v_approval;

  select count(*)=1 and bool_and(release_key='enterprise-web-2026-08-22' and version='2026.08.22.1') into v_history from public.atlas_release_registry;

  perform set_config('http.curlopt_timeout_msec','5000',true);
  perform set_config('http.curlopt_connecttimeout_msec','2000',true);
  begin select status into v_ready_status from extensions.http_get('https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-release-control?api=readiness'); exception when others then v_ready_status:=null; end;
  begin select status into v_private_status from extensions.http_get('https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-release-control?api=releases'); exception when others then v_private_status:=null; end;
  begin
    select status,content into v_health_status,v_health_text from extensions.http_get('https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-public-health');
    begin v_health:=coalesce(v_health_text::jsonb,'{}'::jsonb); exception when others then v_health:='{}'::jsonb; end;
  exception when others then v_health_status:=null; v_health:='{}'::jsonb; end;

  v_checks:=jsonb_build_object(
    'release_tables_rls',v_tables=4,
    'permission_set_complete',v_permissions=7,
    'release_state_machine',coalesce(v_release_rule,false),
    'deployment_state_machine',coalesce(v_deploy_rule,false),
    'manifest_freeze_integrity',coalesce(v_manifest,false),
    'gate_evaluator',coalesce(v_gate,false),
    'approval_integration',coalesce(v_approval,false),
    'public_health_gate',v_health_status=200 and public.atlas_public_health_projection_contract(v_health) and coalesce(v_health->>'overall','') in ('operational','degraded'),
    'sanitized_audit',coalesce(v_audit,false),
    'governance_timeline',coalesce(v_timeline,false),
    'release_control_readiness',v_ready_status=200,
    'authenticated_contract',coalesce(v_auth,false),
    'anonymous_private_rejected',v_private_status in (401,403),
    'rollback_contract',coalesce(v_rollback,false),
    'advisor_contract',coalesce(v_advisor,false),
    'current_baseline_promoted',v_baseline=1,
    'one_current_promoted_release',v_promoted=1,
    'no_duplicate_deployment_attempts',v_dupes=0,
    'cron_active',coalesce(v_cron,false),
    'no_blocking_gate_on_promoted',v_bad_gates=0,
    'historical_registry_preserved',coalesce(v_history,false),
    'recent_trace_rows',v_traces,
    'recent_metric_rows',v_metrics
  );

  v_all:=v_tables=4 and v_permissions=7 and coalesce(v_release_rule,false) and coalesce(v_deploy_rule,false)
    and coalesce(v_manifest,false) and coalesce(v_gate,false) and coalesce(v_approval,false)
    and v_health_status=200 and public.atlas_public_health_projection_contract(v_health) and coalesce(v_health->>'overall','') in ('operational','degraded')
    and coalesce(v_audit,false) and coalesce(v_timeline,false) and v_ready_status=200 and v_private_status in (401,403)
    and coalesce(v_auth,false) and coalesce(v_rollback,false) and coalesce(v_advisor,false)
    and v_baseline=1 and v_promoted=1 and v_dupes=0 and coalesce(v_cron,false) and v_bad_gates=0 and coalesce(v_history,false)
    and v_traces>0 and v_metrics>0;

  insert into public.atlas_runtime_verification_runs(
    verification_type,target_service,target_version,environment,status,started_at,completed_at,duration_ms,
    provider,provider_state,storage_state,checks,metadata,error_code,error_detail
  ) values (
    'release-control-production','atlas-release-control','2','production',case when v_all then 'passed' else 'failed' end,
    v_started,clock_timestamp(),greatest(0,round(extract(epoch from clock_timestamp()-v_started)*1000)::int),
    'supabase-native',case when v_all then 'operational' else 'needs_attention' end,'configured',v_checks,
    jsonb_build_object('completion_gate',v_all,'contains_personal_data',false,'spec','2026-09-08-atlas-release-deployment-control-design','baseline_release_id',v_baseline_id),
    case when v_all then null else 'release_control_completion_gate_failed' end,
    case when v_all then null else 'One or more required release-control production checks failed' end
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.atlas_run_release_e2e() from public,anon,authenticated;
grant execute on function public.atlas_run_release_e2e() to service_role;
