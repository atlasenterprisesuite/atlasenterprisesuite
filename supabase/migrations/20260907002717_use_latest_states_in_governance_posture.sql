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
  current_blocked_verifications integer;
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

  select count(*) into current_blocked_verifications
  from (
    select distinct on (verification_type,target_service) status
    from public.atlas_runtime_verification_runs
    order by verification_type,target_service,created_at desc
  ) latest
  where latest.status in ('blocked','failed');

  posture := case
    when critical_pending > 0 then 'critical_attention'
    when high_risk_pending > 0 or current_blocked_verifications > 0 then 'needs_attention'
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
    'current_blocked_or_failed_verifications',current_blocked_verifications,
    'checked_at',now()
  );
end;
$$;
revoke all on function public.atlas_governance_posture() from public,anon,authenticated;
grant execute on function public.atlas_governance_posture() to postgres,service_role;
