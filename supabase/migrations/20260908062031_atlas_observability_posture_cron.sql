create or replace function public.atlas_observability_posture()
returns jsonb
language plpgsql
stable
security definer
set search_path='public','pg_temp'
as $$
declare
  p0 int;
  p1 int;
  stale_critical int;
  recent_traces int;
  recent_metrics int;
  cron_active boolean;
  posture text;
begin
  select count(*) filter(where severity='P0' and status<>'resolved'),
         count(*) filter(where severity='P1' and status<>'resolved'),
         count(*) filter(where severity in ('P0','P1') and status<>'resolved' and last_seen_at<now()-interval '30 minutes' and assigned_to is null)
  into p0,p1,stale_critical
  from public.atlas_incidents;

  select count(*) into recent_traces from public.atlas_trace_spans where occurred_at>=now()-interval '30 minutes';
  select count(*) into recent_metrics from public.atlas_operational_metrics where recorded_at>=now()-interval '30 minutes';
  select exists(select 1 from cron.job where jobname='atlas-observability-correlation-15m' and active) into cron_active;

  posture := case
    when p0>0 then 'outage'
    when p1>0 or stale_critical>0 then 'needs_attention'
    when not cron_active then 'degraded'
    else 'operational'
  end;

  return jsonb_build_object(
    'service','atlas-observability',
    'status',posture,
    'open_p0',p0,
    'open_p1',p1,
    'stale_critical_without_owner',stale_critical,
    'recent_trace_rows',recent_traces,
    'recent_metric_rows',recent_metrics,
    'correlation_cron_active',cron_active,
    'checked_at',now()
  );
end;
$$;

revoke all on function public.atlas_observability_posture() from public,anon,authenticated;
grant execute on function public.atlas_observability_posture() to postgres,service_role;

create or replace function public.atlas_run_observability_verification()
returns uuid
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  p jsonb;
  corr jsonb;
  run_id uuid;
  incidents_table boolean;
  incidents_rls boolean;
  incident_audit_trigger boolean;
  correlation_fn boolean;
  cron_active boolean;
  permission_set boolean;
  mechanism_ok boolean;
  started timestamptz := clock_timestamp();
begin
  corr := public.atlas_correlate_incidents();
  p := public.atlas_observability_posture();

  incidents_table := to_regclass('public.atlas_incidents') is not null;
  select coalesce(c.relrowsecurity,false) into incidents_rls
  from pg_class c where c.oid=to_regclass('public.atlas_incidents');
  incident_audit_trigger := exists(
    select 1 from pg_trigger
    where tgrelid=to_regclass('public.atlas_incidents')
      and tgname='atlas_audit_atlas_incidents'
      and not tgisinternal
  );
  correlation_fn := to_regprocedure('public.atlas_correlate_incidents()') is not null;
  cron_active := exists(select 1 from cron.job where jobname='atlas-observability-correlation-15m' and active);
  permission_set := (select count(*)=4 from public.identity_permissions where code in ('observability.read','incidents.read','incidents.manage','incidents.resolve'));
  mechanism_ok := incidents_table and incidents_rls and incident_audit_trigger and correlation_fn and cron_active and permission_set;

  insert into public.atlas_runtime_verification_runs(
    verification_type,target_service,target_version,environment,status,started_at,completed_at,duration_ms,
    provider,provider_state,checks,metadata,error_code,error_detail
  ) values (
    'observability-production','atlas-observability','1','production',case when mechanism_ok then 'passed' else 'failed' end,
    started,clock_timestamp(),greatest(0,(extract(epoch from clock_timestamp()-started)*1000)::int),
    'supabase-native',p->>'status',
    jsonb_build_object(
      'incidents_table',incidents_table,
      'incidents_rls',incidents_rls,
      'incident_audit_trigger',incident_audit_trigger,
      'correlation_function',correlation_fn,
      'correlation_cron_active',cron_active,
      'permission_set',permission_set,
      'correlation',corr,
      'posture',p
    ),
    jsonb_build_object('source','supabase-native','contains_personal_data',false),
    case when mechanism_ok then null else 'observability_mechanism_incomplete' end,
    case when mechanism_ok then null else 'One or more ATLAS observability mechanism controls are missing' end
  ) returning id into run_id;

  return run_id;
end;
$$;

revoke all on function public.atlas_run_observability_verification() from public,anon,authenticated;
grant execute on function public.atlas_run_observability_verification() to postgres,service_role;

select cron.schedule(
  'atlas-observability-correlation-15m',
  '2,17,32,47 * * * *',
  $$select public.atlas_run_observability_verification();$$
);
