create or replace function public.atlas_identity_security_posture()
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'auth', 'pg_temp'
as $$
declare
  v_privileged integer := 0;
  v_without_mfa integer := 0;
  v_without_confirmed_email integer := 0;
  v_sessions integer := 0;
  v_aal1_sessions integer := 0;
  v_aal2_sessions integer := 0;
  v_pending_expired integer := 0;
  v_pending_valid integer := 0;
  v_status text;
begin
  with privileged as (
    select distinct om.user_id
    from public.organization_members om
    where om.status='active'
      and om.role in ('owner','admin')
  )
  select
    count(*),
    count(*) filter (where not exists (
      select 1 from auth.mfa_factors f
      where f.user_id=p.user_id and f.status='verified'
    )),
    count(*) filter (where not exists (
      select 1 from auth.users u
      where u.id=p.user_id and u.email_confirmed_at is not null
    ))
  into v_privileged, v_without_mfa, v_without_confirmed_email
  from privileged p;

  with privileged as (
    select distinct om.user_id
    from public.organization_members om
    where om.status='active'
      and om.role in ('owner','admin')
  )
  select
    count(*),
    count(*) filter (where s.aal::text='aal1'),
    count(*) filter (where s.aal::text='aal2')
  into v_sessions, v_aal1_sessions, v_aal2_sessions
  from auth.sessions s
  join privileged p on p.user_id=s.user_id
  where s.not_after is null or s.not_after > now();

  select
    count(*) filter (where status='pending' and expires_at <= now()),
    count(*) filter (where status='pending' and expires_at > now())
  into v_pending_expired, v_pending_valid
  from public.identity_invitations;

  v_status := case
    when v_without_confirmed_email > 0 then 'needs_hardening'
    when v_without_mfa > 0 then 'needs_hardening'
    when v_pending_expired > 0 then 'needs_hardening'
    else 'hardened'
  end;

  return jsonb_build_object(
    'service','atlas-identity',
    'status',v_status,
    'checked_at',now(),
    'privileged_members',v_privileged,
    'privileged_without_verified_mfa',v_without_mfa,
    'privileged_without_confirmed_email',v_without_confirmed_email,
    'active_privileged_sessions',v_sessions,
    'aal1_privileged_sessions',v_aal1_sessions,
    'aal2_privileged_sessions',v_aal2_sessions,
    'pending_valid_invitations',v_pending_valid,
    'pending_expired_invitations',v_pending_expired,
    'sensitive_operations_require_aal2',true
  );
end;
$$;

revoke all on function public.atlas_identity_security_posture() from public;
revoke all on function public.atlas_identity_security_posture() from anon;
revoke all on function public.atlas_identity_security_posture() from authenticated;
grant execute on function public.atlas_identity_security_posture() to service_role;
