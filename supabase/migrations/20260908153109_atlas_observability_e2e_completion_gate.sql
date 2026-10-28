create or replace function public.atlas_run_observability_e2e()
returns uuid
language plpgsql
security definer
set search_path='public','extensions','cron','pg_temp'
set statement_timeout='30s'
as $$
declare
  v_started timestamptz:=clock_timestamp();
  v_now timestamptz:=clock_timestamp();
  v_corr jsonb:='{}'::jsonb;
  v_posture jsonb:='{}'::jsonb;
  v_checks jsonb:='{}'::jsonb;
  v_all boolean:=false;
  v_id uuid;
  v_trace_modules integer:=0;
  v_trace_rows integer:=0;
  v_metric_rows integer:=0;
  v_duplicate_active integer:=0;
  v_perm_count integer:=0;
  v_rls boolean:=false;
  v_audit_trigger boolean:=false;
  v_corr_fn boolean:=false;
  v_cron boolean:=false;
  v_timeline_branch boolean:=false;
  v_auth_contract boolean:=false;
  v_identity_status text;
  v_identity_error text;
  v_identity_consistent boolean:=false;
  v_github_status text;
  v_github_error text;
  v_github_consistent boolean:=false;
  v_copilot_status text;
  v_copilot_clean boolean:=false;
  v_ready_status integer;
  v_ready_content text;
  v_ready jsonb:='{}'::jsonb;
  v_summary_status integer;
  v_incidents_status integer;
  v_health_status integer;
  v_health_content text;
  v_health jsonb:='{}'::jsonb;
  v_health_contract boolean:=false;
  v_health_semantics boolean:=false;
begin
  begin
    v_corr:=public.atlas_correlate_incidents();
  exception when others then
    v_corr:=jsonb_build_object('error','correlation_failed');
  end;

  begin
    v_posture:=public.atlas_observability_posture();
  exception when others then
    v_posture:=jsonb_build_object('status','unknown');
  end;

  select c.relrowsecurity into v_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='atlas_incidents';

  select count(*) into v_perm_count
  from public.identity_permissions
  where code in ('observability.read','incidents.read','incidents.manage','incidents.resolve');

  select exists(
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='atlas_incidents'
      and t.tgname='atlas_audit_incident_transition' and not t.tgisinternal
  ) into v_audit_trigger;

  select to_regprocedure('public.atlas_correlate_incidents()') is not null into v_corr_fn;

  select exists(
    select 1 from cron.job
    where jobname='atlas-observability-correlation-15m' and active=true
  ) into v_cron;

  select pg_get_functiondef(p.oid) ilike '%from public.atlas_incidents%'
  into v_timeline_branch
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='list_governance_timeline'
  limit 1;

  select count(distinct module),count(*) into v_trace_modules,v_trace_rows
  from public.atlas_trace_spans
  where occurred_at>=v_now-interval '45 minutes'
    and module in ('atlas-copilot','atlas-auth','atlas-governance','atlas-infra-status','atlas-runtime-verifier','atlas-repair-bridge');

  select count(*) into v_metric_rows
  from public.atlas_operational_metrics
  where recorded_at>=v_now-interval '45 minutes';

  select count(*) into v_duplicate_active
  from (
    select org_id,incident_key
    from public.atlas_incidents
    where status<>'resolved'
    group by org_id,incident_key
    having count(*)>1
  ) d;

  select status,error_code into v_identity_status,v_identity_error
  from public.atlas_runtime_verification_runs
  where verification_type='identity-security' and target_service='atlas-identity'
  order by created_at desc limit 1;

  if v_identity_status in ('blocked','failed') then
    select exists(
      select 1 from public.atlas_incidents
      where status<>'resolved' and service='atlas-identity'
        and error_code=v_identity_error
        and severity=case when v_identity_error='privileged_email_confirmation_incomplete' then 'P3' else severity end
    ) into v_identity_consistent;
  else
    select not exists(
      select 1 from public.atlas_incidents
      where status<>'resolved' and service='atlas-identity'
    ) into v_identity_consistent;
  end if;

  select status,error_code into v_github_status,v_github_error
  from public.atlas_runtime_verification_runs
  where verification_type='infrastructure-control' and target_service='github-actions'
  order by created_at desc limit 1;

  if v_github_status in ('blocked','failed') then
    select exists(
      select 1 from public.atlas_incidents
      where status<>'resolved' and service='github-actions'
        and error_code=v_github_error
        and severity=case when v_github_error='github_runner_unallocated' then 'P2' else severity end
    ) into v_github_consistent;
  else
    select not exists(
      select 1 from public.atlas_incidents
      where status<>'resolved' and service='github-actions'
    ) into v_github_consistent;
  end if;

  select status into v_copilot_status
  from public.atlas_runtime_verification_runs
  where verification_type='intelligence-production' and target_service='atlas-copilot'
  order by created_at desc limit 1;

  if v_copilot_status='passed' then
    select not exists(
      select 1 from public.atlas_incidents
      where status<>'resolved' and service='atlas-copilot'
    ) into v_copilot_clean;
  else
    v_copilot_clean:=true;
  end if;

  select exists(
    select 1 from public.atlas_runtime_verification_runs
    where verification_type='observability-auth-contract'
      and target_service='atlas-observability'
      and status='passed'
      and created_at>=v_now-interval '90 minutes'
  ) into v_auth_contract;

  perform set_config('http.curlopt_timeout_msec','5000',true);
  perform set_config('http.curlopt_connecttimeout_msec','2000',true);

  begin
    select status,content into v_ready_status,v_ready_content
    from extensions.http_get('https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-observability?api=readiness');
    begin v_ready:=coalesce(v_ready_content::jsonb,'{}'::jsonb); exception when others then v_ready:='{}'::jsonb; end;
  exception when others then
    v_ready_status:=null;v_ready:='{}'::jsonb;
  end;

  begin
    select status into v_summary_status
    from extensions.http_get('https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-observability?api=summary');
  exception when others then v_summary_status:=null; end;

  begin
    select status into v_incidents_status
    from extensions.http_get('https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-observability?api=incidents');
  exception when others then v_incidents_status:=null; end;

  begin
    select status,content into v_health_status,v_health_content
    from extensions.http_get('https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-public-health');
    begin v_health:=coalesce(v_health_content::jsonb,'{}'::jsonb); exception when others then v_health:='{}'::jsonb; end;
  exception when others then
    v_health_status:=null;v_health:='{}'::jsonb;
  end;

  begin
    v_health_contract:=public.atlas_public_health_projection_contract(v_health);
  exception when others then v_health_contract:=false; end;
  v_health_semantics:=coalesce(v_health->>'overall','') in ('operational','degraded','outage') and v_health ? 'checkedAt';

  v_checks:=jsonb_build_object(
    'incident_model_rls',coalesce(v_rls,false),
    'permission_set_complete',v_perm_count=4,
    'audit_trigger',v_audit_trigger,
    'correlation_function',v_corr_fn,
    'correlation_cron_active',v_cron,
    'governance_incident_timeline',coalesce(v_timeline_branch,false),
    'first_wave_trace_modules',v_trace_modules,
    'recent_trace_rows',v_trace_rows,
    'recent_metric_rows',v_metric_rows,
    'recent_first_wave_telemetry',v_trace_modules=6 and v_trace_rows>0 and v_metric_rows>0,
    'no_duplicate_active_incidents',v_duplicate_active=0,
    'identity_current_incident_consistent',v_identity_consistent,
    'github_current_incident_consistent',v_github_consistent,
    'copilot_historical_incident_clean',v_copilot_clean,
    'observability_auth_contract',v_auth_contract,
    'readiness_200',v_ready_status=200 and v_ready->>'service'='atlas-observability' and v_ready->>'state'='ready',
    'anonymous_summary_rejected',v_summary_status in (401,403),
    'anonymous_incidents_rejected',v_incidents_status in (401,403),
    'public_health_200',v_health_status=200,
    'public_health_non_leak',v_health_contract,
    'public_health_semantics',v_health_semantics,
    'posture',v_posture,
    'correlation',v_corr
  );

  v_all:=
    coalesce(v_rls,false)
    and v_perm_count=4
    and v_audit_trigger
    and v_corr_fn
    and v_cron
    and coalesce(v_timeline_branch,false)
    and v_trace_modules=6 and v_trace_rows>0 and v_metric_rows>0
    and v_duplicate_active=0
    and v_identity_consistent
    and v_github_consistent
    and v_copilot_clean
    and v_auth_contract
    and v_ready_status=200 and v_ready->>'service'='atlas-observability' and v_ready->>'state'='ready'
    and v_summary_status in (401,403)
    and v_incidents_status in (401,403)
    and v_health_status=200
    and v_health_contract
    and v_health_semantics;

  insert into public.atlas_runtime_verification_runs(
    verification_type,target_service,target_version,environment,status,
    started_at,completed_at,duration_ms,provider,provider_state,storage_state,
    checks,metadata,error_code,error_detail
  ) values (
    'observability-production','atlas-observability','1','production',
    case when v_all then 'passed' else 'failed' end,
    v_started,clock_timestamp(),greatest(0,round(extract(epoch from (clock_timestamp()-v_started))*1000)::int),
    'supabase-native',coalesce(v_posture->>'status','unknown'),'configured',
    v_checks,
    jsonb_build_object('completion_gate',v_all,'contains_personal_data',false,'spec','2026-09-07-atlas-observability-incident-response-design'),
    case when v_all then null else 'observability_completion_gate_failed' end,
    case when v_all then null else 'One or more required observability production checks failed' end
  ) returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.atlas_run_observability_e2e() from public,anon,authenticated;
grant execute on function public.atlas_run_observability_e2e() to service_role;
