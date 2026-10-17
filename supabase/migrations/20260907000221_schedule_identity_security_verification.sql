create or replace function public.atlas_run_identity_security_verification()
returns uuid
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_posture jsonb;
  v_status text;
  v_error_code text;
  v_id uuid;
begin
  v_posture := public.atlas_identity_security_posture();
  v_status := case when v_posture->>'status' = 'hardened' then 'passed' else 'blocked' end;
  v_error_code := case
    when coalesce((v_posture->>'privileged_without_confirmed_email')::int,0) > 0 then 'privileged_email_confirmation_incomplete'
    when coalesce((v_posture->>'privileged_without_verified_mfa')::int,0) > 0 then 'privileged_mfa_incomplete'
    when coalesce((v_posture->>'pending_expired_invitations')::int,0) > 0 then 'expired_identity_invitations_pending'
    else null
  end;

  insert into public.atlas_runtime_verification_runs(
    verification_type,
    target_service,
    target_version,
    environment,
    status,
    started_at,
    completed_at,
    duration_ms,
    provider,
    provider_state,
    checks,
    metadata,
    error_code,
    error_detail
  ) values (
    'identity-security',
    'atlas-identity',
    '3',
    'production',
    v_status,
    v_started,
    clock_timestamp(),
    greatest(0, floor(extract(epoch from (clock_timestamp()-v_started))*1000)::int),
    'supabase-auth',
    case when v_status='passed' then 'verified' else 'needs_hardening' end,
    jsonb_build_object('identity_posture', v_posture),
    jsonb_build_object('source','supabase-native','monitor_version',1),
    v_error_code,
    case when v_error_code is null then null else 'ATLAS Identity privileged-account hardening is incomplete' end
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.atlas_run_identity_security_verification() from public;
revoke all on function public.atlas_run_identity_security_verification() from anon;
revoke all on function public.atlas_run_identity_security_verification() from authenticated;
grant execute on function public.atlas_run_identity_security_verification() to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname='atlas-identity-security-verification-15m';

select cron.schedule(
  'atlas-identity-security-verification-15m',
  '11,26,41,56 * * * *',
  'select public.atlas_run_identity_security_verification();'
);
