create or replace function public.atlas_governance_posture()
returns jsonb
language plpgsql
stable
security definer
set search_path='public','pg_temp'
as $$
declare
  pending_count integer;
  high_risk_pending integer;
  critical_pending integer;
  expired_count integer;
  audit_24h integer;
  domain_24h integer;
  blocked_verifications_24h integer;
  posture text;
begin
  select count(*),
         count(*) filter (where risk_level in ('high','critical')),
         count(*) filter (where risk_level='critical')
  into pending_count,high_risk_pending,critical_pending
  from public.atlas_approvals where status='pending';

  select count(*) into expired_count from public.atlas_approvals where status='expired' and decided_at >= now()-interval '24 hours';
  select count(*) into audit_24h from public.audit_logs where created_at >= now()-interval '24 hours';
  select count(*) into domain_24h from public.atlas_events where occurred_at >= now()-interval '24 hours';
  select count(*) into blocked_verifications_24h from public.atlas_runtime_verification_runs where created_at >= now()-interval '24 hours' and status in ('blocked','failed');

  posture := case
    when critical_pending > 0 then 'critical_attention'
    when high_risk_pending > 0 or blocked_verifications_24h > 0 then 'needs_attention'
    else 'operational'
  end;

  return jsonb_build_object(
    'service','atlas-governance',
    'status',posture,
    'pending_approvals',pending_count,
    'high_risk_pending',high_risk_pending,
    'critical_pending',critical_pending,
    'expired_last_24h',expired_count,
    'audit_events_last_24h',audit_24h,
    'domain_events_last_24h',domain_24h,
    'blocked_or_failed_verifications_last_24h',blocked_verifications_24h,
    'checked_at',now()
  );
end;
$$;
revoke all on function public.atlas_governance_posture() from public,anon,authenticated;
grant execute on function public.atlas_governance_posture() to postgres,service_role;

create or replace function public.atlas_run_governance_verification()
returns uuid
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  p jsonb;
  run_id uuid;
  approvals_table boolean;
  approvals_rls boolean;
  approval_audit_trigger boolean;
  timeline_fn boolean;
  permission_set boolean;
  mechanism_ok boolean;
begin
  perform public.atlas_expire_pending_approvals();
  p := public.atlas_governance_posture();
  approvals_table := to_regclass('public.atlas_approvals') is not null;
  select coalesce(c.relrowsecurity,false) into approvals_rls from pg_class c where c.oid=to_regclass('public.atlas_approvals');
  approval_audit_trigger := exists(select 1 from pg_trigger where tgrelid=to_regclass('public.atlas_approvals') and tgname='atlas_audit_atlas_approvals' and not tgisinternal);
  timeline_fn := to_regprocedure('public.list_governance_timeline(uuid,integer)') is not null;
  permission_set := (select count(*)=4 from public.identity_permissions where code in ('approvals.read','approvals.manage','approvals.decide','governance.read'));
  mechanism_ok := approvals_table and approvals_rls and approval_audit_trigger and timeline_fn and permission_set;

  insert into public.atlas_runtime_verification_runs(
    verification_type,target_service,target_version,environment,status,started_at,completed_at,duration_ms,
    provider,provider_state,checks,metadata,error_code,error_detail
  ) values (
    'governance-production','atlas-governance','1','production',case when mechanism_ok then 'passed' else 'failed' end,
    now(),now(),0,'supabase-postgres',p->>'status',
    jsonb_build_object(
      'approvals_table',approvals_table,
      'approvals_rls',approvals_rls,
      'approval_audit_trigger',approval_audit_trigger,
      'timeline_function',timeline_fn,
      'permission_set',permission_set,
      'posture',p
    ),
    jsonb_build_object('source','supabase-native','contains_personal_data',false),
    case when mechanism_ok then null else 'governance_mechanism_incomplete' end,
    case when mechanism_ok then null else 'One or more ATLAS governance controls are missing' end
  ) returning id into run_id;

  return run_id;
end;
$$;
revoke all on function public.atlas_run_governance_verification() from public,anon,authenticated;
grant execute on function public.atlas_run_governance_verification() to postgres,service_role;

do $$
declare jid bigint;
begin
  select jobid into jid from cron.job where jobname='atlas-governance-verification-15m' limit 1;
  if jid is not null then perform cron.unschedule(jid); end if;
  perform cron.schedule('atlas-governance-verification-15m','13,28,43,58 * * * *','select public.atlas_run_governance_verification();');
end$$;
