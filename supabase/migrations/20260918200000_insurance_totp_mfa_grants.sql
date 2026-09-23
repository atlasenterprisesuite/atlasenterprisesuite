alter table public.insurance_verification_grants
  add column if not exists verification_method text not null default 'email_otp';

alter table public.insurance_verification_grants
  alter column challenge_id drop not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.insurance_verification_grants'::regclass
       and conname = 'insurance_verification_grants_method_check'
  ) then
    alter table public.insurance_verification_grants
      add constraint insurance_verification_grants_method_check
      check (verification_method in ('email_otp', 'totp'));
  end if;
end
$$;

grant select (verification_method)
  on public.insurance_verification_grants
  to authenticated;

create or replace function public.create_insurance_mfa_grant(
  p_org_id uuid,
  p_user_id uuid,
  p_scope text,
  p_resource_id text,
  p_verified_at timestamptz,
  p_expires_at timestamptz
)
returns table (
  scope text,
  resource_id text,
  verified_at timestamptz,
  expires_at timestamptz,
  verification_method text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant_id uuid;
begin
  if p_scope not in ('insurance_access', 'member_policy') then
    raise invalid_parameter_value using message = 'invalid_scope';
  end if;

  if (p_scope = 'insurance_access' and p_resource_id is not null)
     or (p_scope = 'member_policy' and (p_resource_id is null or length(trim(p_resource_id)) = 0)) then
    raise invalid_parameter_value using message = 'invalid_resource';
  end if;

  if p_verified_at is null or p_expires_at is null or p_expires_at <= p_verified_at then
    raise invalid_parameter_value using message = 'invalid_grant_expiry';
  end if;

  insert into public.insurance_verification_grants (
    org_id,
    user_id,
    scope,
    resource_id,
    verified_at,
    expires_at,
    challenge_id,
    verification_method
  ) values (
    p_org_id,
    p_user_id,
    p_scope,
    p_resource_id,
    p_verified_at,
    p_expires_at,
    null,
    'totp'
  )
  returning id into v_grant_id;

  insert into public.insurance_verification_audit (
    org_id,
    user_id,
    challenge_id,
    scope,
    resource_id,
    action,
    error_code
  ) values (
    p_org_id,
    p_user_id,
    null,
    p_scope,
    p_resource_id,
    'verify_success',
    null
  );

  return query
  select
    g.scope,
    g.resource_id,
    g.verified_at,
    g.expires_at,
    g.verification_method
  from public.insurance_verification_grants as g
  where g.id = v_grant_id;
end;
$$;

revoke all on function public.create_insurance_mfa_grant(uuid,uuid,text,text,timestamptz,timestamptz)
  from public, anon, authenticated;
grant execute on function public.create_insurance_mfa_grant(uuid,uuid,text,text,timestamptz,timestamptz)
  to service_role;

comment on function public.create_insurance_mfa_grant(uuid,uuid,text,text,timestamptz,timestamptz) is
  'Creates a short-lived ATLAS Insurance grant after the Edge Function verifies a recent Supabase AAL2 TOTP event. Executable only by service_role.';
