-- ATLAS Device & Account Protection governance.
-- Trusted backend code emits risk evidence, passkey step-up grants and provider
-- revocation outcomes. Authenticated clients may only consume valid grants through
-- guarded transitions; they cannot self-declare verification or provider success.

create or replace function public.security_protection_action_is_valid(action_code_value text)
returns boolean
language sql
immutable
security definer
set search_path = public, pg_temp
as $$
  select action_code_value in (
    'account.password.change',
    'account.recovery.change',
    'account.passkey.remove',
    'account.protection.disable',
    'account.delete',
    'admin.role.grant',
    'admin.role.revoke',
    'payout.destination.change',
    'api_key.create_privileged',
    'api_key.revoke_privileged',
    'session.revoke_others',
    'device.trust',
    'device.revoke'
  );
$$;

revoke all on function public.security_protection_action_is_valid(text) from public, anon, authenticated;
grant execute on function public.security_protection_action_is_valid(text) to service_role;

create or replace function public.record_security_risk_event(
  organization_uuid uuid,
  user_uuid uuid,
  device_uuid uuid,
  session_reference_value text,
  action_code_value text,
  decision_value text,
  score_value integer,
  reasons_value text[],
  signals_used_value jsonb,
  signals_unknown_value jsonb,
  provider_evidence_value jsonb,
  policy_version_value text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_uuid uuid;
begin
  if organization_uuid is null or user_uuid is null then
    raise exception 'Organization and user are required';
  end if;

  if not public.security_protection_action_is_valid(action_code_value) then
    raise exception 'Unsupported protected action';
  end if;

  if decision_value not in ('allow','step_up','delay','deny') then
    raise exception 'Unsupported risk decision';
  end if;

  if score_value is null or score_value < 0 or score_value > 100 then
    raise exception 'Risk score must be between 0 and 100';
  end if;

  if coalesce(btrim(policy_version_value), '') = '' then
    raise exception 'Policy version is required';
  end if;

  if not exists (
    select 1
    from public.organization_members membership
    where membership.org_id = organization_uuid
      and membership.user_id = user_uuid
      and membership.status = 'active'
  ) then
    raise exception 'Active organization membership required';
  end if;

  if device_uuid is not null and not exists (
    select 1
    from public.security_devices device
    where device.id = device_uuid
      and device.org_id = organization_uuid
      and device.user_id = user_uuid
  ) then
    raise exception 'Security device does not belong to the user and organization';
  end if;

  insert into public.security_risk_events (
    org_id,
    user_id,
    device_id,
    session_reference,
    action_code,
    decision,
    score,
    reasons,
    signals_used,
    signals_unknown,
    provider_evidence_json,
    policy_version
  ) values (
    organization_uuid,
    user_uuid,
    device_uuid,
    nullif(btrim(session_reference_value), ''),
    action_code_value,
    decision_value,
    score_value,
    coalesce(reasons_value, '{}'::text[]),
    coalesce(signals_used_value, '[]'::jsonb),
    coalesce(signals_unknown_value, '[]'::jsonb),
    coalesce(provider_evidence_value, '{}'::jsonb),
    policy_version_value
  )
  returning id into event_uuid;

  return event_uuid;
end;
$$;

revoke all on function public.record_security_risk_event(uuid,uuid,uuid,text,text,text,integer,text[],jsonb,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.record_security_risk_event(uuid,uuid,uuid,text,text,text,integer,text[],jsonb,jsonb,jsonb,text) to service_role;

create or replace function public.grant_security_step_up(
  organization_uuid uuid,
  user_uuid uuid,
  device_uuid uuid,
  risk_event_uuid uuid,
  passkey_uuid uuid,
  action_code_value text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_passkey public.security_passkeys%rowtype;
  current_risk public.security_risk_events%rowtype;
  grant_uuid uuid;
begin
  if not public.security_protection_action_is_valid(action_code_value) then
    raise exception 'Unsupported protected action';
  end if;

  select passkey.*
  into current_passkey
  from public.security_passkeys passkey
  where passkey.id = passkey_uuid
    and passkey.org_id = organization_uuid
    and passkey.user_id = user_uuid
    and passkey.revoked_at is null;

  if current_passkey.id is null then
    raise exception 'Active verified passkey required';
  end if;

  select risk.*
  into current_risk
  from public.security_risk_events risk
  where risk.id = risk_event_uuid
    and risk.org_id = organization_uuid
    and risk.user_id = user_uuid
    and risk.action_code = action_code_value;

  if current_risk.id is null then
    raise exception 'Matching security risk event required';
  end if;

  if device_uuid is not null and not exists (
    select 1
    from public.security_devices device
    where device.id = device_uuid
      and device.org_id = organization_uuid
      and device.user_id = user_uuid
      and device.status not in ('revoked','compromised')
  ) then
    raise exception 'Active security device required';
  end if;

  insert into public.security_step_up_grants (
    org_id,
    user_id,
    device_id,
    risk_event_id,
    passkey_id,
    action_code,
    method,
    assurance_at,
    expires_at
  ) values (
    organization_uuid,
    user_uuid,
    device_uuid,
    current_risk.id,
    current_passkey.id,
    action_code_value,
    'passkey',
    now(),
    now() + interval '10 minutes'
  )
  returning id into grant_uuid;

  return grant_uuid;
end;
$$;

revoke all on function public.grant_security_step_up(uuid,uuid,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.grant_security_step_up(uuid,uuid,uuid,uuid,uuid,text) to service_role;

create or replace function public.trust_security_device(
  device_uuid uuid,
  reason_value text,
  grant_uuid uuid
)
returns public.security_devices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_device public.security_devices%rowtype;
  current_grant public.security_step_up_grants%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select device.*
  into current_device
  from public.security_devices device
  where device.id = device_uuid
  for update;

  if current_device.id is null then
    raise exception 'Security device not found';
  end if;

  if not public.is_org_member(current_device.org_id) then
    raise exception 'Active organization membership required';
  end if;

  if current_device.user_id <> auth.uid() then
    raise exception 'A user may trust only their own device';
  end if;

  if coalesce(btrim(reason_value), '') = '' then
    raise exception 'Trust reason is required';
  end if;

  if current_device.status not in ('revoked','compromised') then
    null;
  else
    raise exception 'Revoked or compromised devices cannot self-trust';
  end if;

  select security_grant.*
  into current_grant
  from public.security_step_up_grants security_grant
  where security_grant.id = grant_uuid
    and security_grant.org_id = current_device.org_id
    and security_grant.user_id = auth.uid()
    and security_grant.device_id = current_device.id
    and security_grant.action_code = 'device.trust'
    and security_grant.method = 'passkey'
    and security_grant.expires_at > now()
    and security_grant.revoked_at is null;

  if current_grant.id is null then
    raise exception 'Fresh action-scoped passkey grant required';
  end if;

  update public.security_devices
  set status = 'trusted',
      trusted_at = now(),
      trusted_by_user_id = auth.uid(),
      trust_reason = reason_value,
      revoked_at = null,
      compromised_at = null,
      updated_at = now()
  where id = current_device.id
  returning * into current_device;

  return current_device;
end;
$$;

revoke all on function public.trust_security_device(uuid,text,uuid) from public, anon;
grant execute on function public.trust_security_device(uuid,text,uuid) to authenticated;

create or replace function public.revoke_security_device(
  device_uuid uuid,
  reason_value text,
  grant_uuid uuid
)
returns public.security_devices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_device public.security_devices%rowtype;
  current_grant public.security_step_up_grants%rowtype;
  actor_can_manage boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select device.*
  into current_device
  from public.security_devices device
  where device.id = device_uuid
  for update;

  if current_device.id is null then
    raise exception 'Security device not found';
  end if;

  if not public.is_org_member(current_device.org_id) then
    raise exception 'Active organization membership required';
  end if;

  actor_can_manage := current_device.user_id = auth.uid()
    or public.has_identity_permission(current_device.org_id,'security.protection.manage_org');

  if not actor_can_manage then
    raise exception 'Security protection management permission required';
  end if;

  if coalesce(btrim(reason_value), '') = '' then
    raise exception 'Revocation reason is required';
  end if;

  select security_grant.*
  into current_grant
  from public.security_step_up_grants security_grant
  where security_grant.id = grant_uuid
    and security_grant.org_id = current_device.org_id
    and security_grant.user_id = auth.uid()
    and security_grant.action_code = 'device.revoke'
    and security_grant.method = 'passkey'
    and security_grant.expires_at > now()
    and security_grant.revoked_at is null;

  if current_grant.id is null then
    raise exception 'Fresh action-scoped passkey grant required';
  end if;

  update public.security_devices
  set status = 'revoked',
      revoked_at = now(),
      trusted_at = null,
      trusted_by_user_id = null,
      trust_expires_at = null,
      trust_reason = reason_value,
      updated_at = now()
  where id = current_device.id
  returning * into current_device;

  return current_device;
end;
$$;

revoke all on function public.revoke_security_device(uuid,text,uuid) from public, anon;
grant execute on function public.revoke_security_device(uuid,text,uuid) to authenticated;

create or replace function public.authorize_security_protected_action(
  action_code_value text,
  device_uuid uuid,
  grant_uuid uuid,
  risk_event_uuid uuid,
  target_reference_value text,
  configured_delay_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_device public.security_devices%rowtype;
  current_grant public.security_step_up_grants%rowtype;
  current_risk public.security_risk_events%rowtype;
  existing_delay public.security_action_delays%rowtype;
  delay_uuid uuid;
  delay_not_before timestamptz;
  delay_seconds integer;
  delayed_action boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.security_protection_action_is_valid(action_code_value) then
    raise exception 'Unsupported protected action';
  end if;

  select device.*
  into current_device
  from public.security_devices device
  where device.id = device_uuid
    and device.user_id = auth.uid();

  if current_device.id is null then
    raise exception 'Current security device required';
  end if;

  if not public.is_org_member(current_device.org_id) then
    raise exception 'Active organization membership required';
  end if;

  if current_device.status in ('revoked','compromised') then
    return jsonb_build_object(
      'decision', 'deny',
      'reason', 'device_unusable',
      'device_id', current_device.id
    );
  end if;

  select risk.*
  into current_risk
  from public.security_risk_events risk
  where risk.id = risk_event_uuid
    and risk.org_id = current_device.org_id
    and risk.device_id = current_device.id
    and risk.created_at >= now() - interval '5 minutes';

  if current_risk.id is null then
    raise exception 'Fresh server-created risk event required';
  end if;

  if current_risk.user_id = auth.uid()
     and current_risk.action_code = action_code_value then
    null;
  else
    raise exception 'Risk event does not match the authenticated action';
  end if;

  if current_risk.decision = 'deny' then
    return jsonb_build_object(
      'decision', 'deny',
      'risk_event_id', current_risk.id,
      'policy_version', current_risk.policy_version
    );
  end if;

  if current_risk.decision = 'step_up' then
    return jsonb_build_object(
      'decision', 'step_up',
      'risk_event_id', current_risk.id,
      'required_assurance', 'passkey',
      'policy_version', current_risk.policy_version
    );
  end if;

  select security_grant.*
  into current_grant
  from public.security_step_up_grants security_grant
  where security_grant.id = grant_uuid
    and security_grant.org_id = current_device.org_id
    and security_grant.user_id = auth.uid()
    and security_grant.action_code = action_code_value
    and security_grant.method = 'passkey'
    and security_grant.expires_at > now()
    and security_grant.revoked_at is null;

  if current_grant.id is null then
    return jsonb_build_object(
      'decision', 'step_up',
      'risk_event_id', current_risk.id,
      'required_assurance', 'passkey',
      'policy_version', current_risk.policy_version
    );
  end if;

  delayed_action := action_code_value in (
    'account.recovery.change',
    'account.passkey.remove',
    'account.protection.disable',
    'account.delete',
    'admin.role.grant',
    'payout.destination.change'
  );

  if current_risk.decision = 'delay' then
    if not delayed_action then
      return jsonb_build_object(
        'decision', 'deny',
        'reason', 'delay_not_permitted_for_action',
        'risk_event_id', current_risk.id
      );
    end if;

    delay_seconds := greatest(900, least(86400, coalesce(configured_delay_seconds, 3600)));

    select delay.*
    into existing_delay
    from public.security_action_delays delay
    where delay.org_id = current_device.org_id
      and delay.user_id = auth.uid()
      and delay.action_code = action_code_value
      and coalesce(delay.target_reference, '') = coalesce(nullif(btrim(target_reference_value), ''), '')
      and delay.state in ('pending','ready')
    order by delay.created_at desc
    limit 1;

    if existing_delay.id is not null then
      return jsonb_build_object(
        'decision', 'delay',
        'risk_event_id', current_risk.id,
        'delay_id', existing_delay.id,
        'not_before', existing_delay.not_before,
        'policy_version', existing_delay.policy_version
      );
    end if;

    insert into public.security_action_delays (
      org_id,
      user_id,
      device_id,
      risk_event_id,
      step_up_grant_id,
      action_code,
      target_reference,
      state,
      policy_version,
      not_before,
      expires_at
    ) values (
      current_device.org_id,
      auth.uid(),
      current_device.id,
      current_risk.id,
      current_grant.id,
      action_code_value,
      nullif(btrim(target_reference_value), ''),
      'pending',
      current_risk.policy_version,
      now() + make_interval(secs => delay_seconds),
      now() + make_interval(secs => delay_seconds) + interval '24 hours'
    )
    returning id, not_before into delay_uuid, delay_not_before;

    return jsonb_build_object(
      'decision', 'delay',
      'risk_event_id', current_risk.id,
      'delay_id', delay_uuid,
      'not_before', delay_not_before,
      'policy_version', current_risk.policy_version
    );
  end if;

  if current_risk.decision <> 'allow' then
    raise exception 'Unsupported stored risk decision';
  end if;

  return jsonb_build_object(
    'decision', 'allow',
    'risk_event_id', current_risk.id,
    'grant_id', current_grant.id,
    'policy_version', current_risk.policy_version
  );
end;
$$;

revoke all on function public.authorize_security_protected_action(text,uuid,uuid,uuid,text,integer) from public, anon;
grant execute on function public.authorize_security_protected_action(text,uuid,uuid,uuid,text,integer) to authenticated;

create or replace function public.transition_security_action_delay(
  delay_uuid uuid,
  next_state text,
  reason_value text,
  downstream_success_evidence_value jsonb default null
)
returns public.security_action_delays
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_delay public.security_action_delays%rowtype;
  caller_role text := coalesce(auth.jwt()->>'role', '');
  caller_is_service boolean := coalesce(auth.jwt()->>'role', '') = 'service_role';
begin
  select delay.*
  into current_delay
  from public.security_action_delays delay
  where delay.id = delay_uuid
  for update;

  if current_delay.id is null then
    raise exception 'Security action delay not found';
  end if;

  if coalesce(btrim(reason_value), '') = '' then
    raise exception 'Transition reason is required';
  end if;

  -- Authenticated clients may cancel only their own waiting action. They can never
  -- mark an operation ready/executed merely from the browser.
  if not caller_is_service then
    if auth.uid() is null then
      raise exception 'Authentication required';
    end if;
    if not public.is_org_member(current_delay.org_id) or current_delay.user_id <> auth.uid() then
      raise exception 'Delay does not belong to the authenticated user';
    end if;
    if next_state = 'cancelled' and current_delay.state in ('pending','ready') then
      null;
    else
      raise exception 'Only cancellation is permitted for authenticated clients';
    end if;
  else
    -- service_role transitions: ('pending','ready'), ('ready','executed'),
    -- ('pending','cancelled'), plus fail-closed deny/expiry transitions.
    if (current_delay.state, next_state) not in (
      ('pending','ready'),
      ('ready','executed'),
      ('pending','cancelled'),
      ('ready','cancelled'),
      ('pending','denied'),
      ('ready','denied'),
      ('pending','expired'),
      ('ready','expired')
    ) then
      raise exception 'Illegal security delay transition';
    end if;
  end if;

  if next_state = 'ready' and now() < current_delay.not_before then
    raise exception 'Security delay has not elapsed';
  end if;

  if next_state = 'executed' and downstream_success_evidence_value is null then
    raise exception 'Executed status requires downstream success evidence';
  end if;

  update public.security_action_delays
  set state = next_state,
      transition_reason = reason_value,
      downstream_success_evidence = case
        when next_state = 'executed' then downstream_success_evidence_value
        else downstream_success_evidence
      end,
      executed_at = case when next_state = 'executed' then now() else executed_at end,
      cancelled_at = case when next_state = 'cancelled' then now() else cancelled_at end,
      denied_at = case when next_state = 'denied' then now() else denied_at end,
      updated_at = now()
  where id = current_delay.id
  returning * into current_delay;

  return current_delay;
end;
$$;

revoke all on function public.transition_security_action_delay(uuid,text,text,jsonb) from public, anon;
grant execute on function public.transition_security_action_delay(uuid,text,text,jsonb) to authenticated, service_role;

create or replace function public.record_security_session_revocation(
  organization_uuid uuid,
  user_uuid uuid,
  target_session_reference_value text,
  provider_status_value text,
  provider_reference_value text,
  failure_code_value text,
  reason_value text,
  requested_by_user_uuid uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  revocation_uuid uuid;
  completed_at_value timestamptz;
begin
  if organization_uuid is null or user_uuid is null then
    raise exception 'Organization and user are required';
  end if;

  if coalesce(btrim(target_session_reference_value), '') = '' then
    raise exception 'Target session reference is required';
  end if;

  if not (provider_status_value in ('requested','provider_succeeded','provider_failed')) then
    raise exception 'Unsupported provider revocation status';
  end if;

  if provider_status_value = 'provider_succeeded' and provider_reference_value is null then
    raise exception 'Provider success requires provider reference';
  end if;

  if provider_status_value = 'provider_failed' and failure_code_value is null then
    raise exception 'Provider failure requires failure code';
  end if;

  if not exists (
    select 1
    from public.organization_members membership
    where membership.org_id = organization_uuid
      and membership.user_id = user_uuid
      and membership.status = 'active'
  ) then
    raise exception 'Active organization membership required';
  end if;

  if requested_by_user_uuid is not null and not exists (
    select 1
    from public.organization_members membership
    where membership.org_id = organization_uuid
      and membership.user_id = requested_by_user_uuid
      and membership.status = 'active'
  ) then
    raise exception 'Revocation actor must be an active organization member';
  end if;

  completed_at_value := case
    when provider_status_value in ('provider_succeeded','provider_failed') then now()
    else null
  end;

  insert into public.security_session_revocations (
    org_id,
    user_id,
    target_session_reference,
    provider_status,
    provider_reference,
    failure_code,
    reason,
    requested_by,
    completed_at
  ) values (
    organization_uuid,
    user_uuid,
    target_session_reference_value,
    provider_status_value,
    provider_reference_value,
    failure_code_value,
    reason_value,
    requested_by_user_uuid,
    completed_at_value
  )
  returning id into revocation_uuid;

  return revocation_uuid;
end;
$$;

revoke all on function public.record_security_session_revocation(uuid,uuid,text,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.record_security_session_revocation(uuid,uuid,text,text,text,text,text,uuid) to service_role;
