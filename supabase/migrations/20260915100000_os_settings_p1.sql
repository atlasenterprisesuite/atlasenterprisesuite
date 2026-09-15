-- ATLAS Native Improvement Engine: os.settings P1
-- Reuse canonical settings/audit rails. Identity and organization scope are derived server-side.

alter table public.atlas_user_preferences
  add column if not exists os_settings_version bigint not null default 0 check (os_settings_version >= 0);

alter table public.organization_settings
  add column if not exists os_settings_version bigint not null default 0 check (os_settings_version >= 0);

create or replace function public.normalize_os_user_settings(p_settings jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'syncEnabled', coalesce(case when jsonb_typeof(p_settings->'syncEnabled') = 'boolean' then (p_settings->>'syncEnabled')::boolean end, true),
    'crossDeviceHandoffEnabled', coalesce(case when jsonb_typeof(p_settings->'crossDeviceHandoffEnabled') = 'boolean' then (p_settings->>'crossDeviceHandoffEnabled')::boolean end, true),
    'offlineDraftsEnabled', coalesce(case when jsonb_typeof(p_settings->'offlineDraftsEnabled') = 'boolean' then (p_settings->>'offlineDraftsEnabled')::boolean end, true),
    'autoBackupEnabled', coalesce(case when jsonb_typeof(p_settings->'autoBackupEnabled') = 'boolean' then (p_settings->>'autoBackupEnabled')::boolean end, false),
    'backupRetentionDays', case
      when jsonb_typeof(p_settings->'backupRetentionDays') = 'number'
        then least(365, greatest(1, round((p_settings->>'backupRetentionDays')::numeric)::int))
      else 30
    end,
    'notificationsEnabled', coalesce(case when jsonb_typeof(p_settings->'notificationsEnabled') = 'boolean' then (p_settings->>'notificationsEnabled')::boolean end, true),
    'notificationClasses', coalesce(
      (
        select jsonb_agg(value order by value)
        from (
          select distinct value
          from jsonb_array_elements_text(
            case when jsonb_typeof(p_settings->'notificationClasses') = 'array'
              then p_settings->'notificationClasses'
              else '["security","system","collaboration"]'::jsonb
            end
          ) as allowed(value)
          where value in ('security','system','collaboration','finance','people','operations')
        ) deduped
      ),
      '[]'::jsonb
    )
  );
$$;

create or replace function public.normalize_os_organization_settings(p_settings jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'forceBackupEnabled', coalesce(case when jsonb_typeof(p_settings->'forceBackupEnabled') = 'boolean' then (p_settings->>'forceBackupEnabled')::boolean end, false),
    'minimumBackupRetentionDays', case
      when jsonb_typeof(p_settings->'minimumBackupRetentionDays') = 'number'
        then least(365, greatest(1, round((p_settings->>'minimumBackupRetentionDays')::numeric)::int))
      else 7
    end,
    'requireVerifiedAdapters', coalesce(case when jsonb_typeof(p_settings->'requireVerifiedAdapters') = 'boolean' then (p_settings->>'requireVerifiedAdapters')::boolean end, true),
    'crossDeviceHandoffAllowed', coalesce(case when jsonb_typeof(p_settings->'crossDeviceHandoffAllowed') = 'boolean' then (p_settings->>'crossDeviceHandoffAllowed')::boolean end, true),
    'deviceActionsMode', case
      when p_settings->>'deviceActionsMode' in ('deny','confirm','allow') then p_settings->>'deviceActionsMode'
      else 'confirm'
    end
  );
$$;

create or replace function public.resolve_os_settings_context()
returns table(org_id uuid, role text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (
    select auth.uid() as user_id
  ), preferred as (
    select p.default_org_id
    from public.atlas_user_preferences p, me
    where p.user_id = me.user_id
  )
  select om.org_id, om.role
  from public.organization_members om, me
  left join preferred p on true
  where me.user_id is not null
    and om.user_id = me.user_id
    and om.status = 'active'
  order by (om.org_id = p.default_org_id) desc nulls last, om.org_id
  limit 1;
$$;

create or replace function public.get_os_settings()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_role text;
  v_personal jsonb := '{}'::jsonb;
  v_personal_version bigint := 0;
  v_organization jsonb := '{}'::jsonb;
  v_organization_version bigint := 0;
begin
  if v_user is null then
    raise exception 'authentication_required';
  end if;

  select c.org_id, c.role into v_org, v_role
  from public.resolve_os_settings_context() c;

  if v_org is null then
    raise exception 'no_active_organization';
  end if;

  select coalesce(p.preferences -> 'os', '{}'::jsonb), p.os_settings_version
  into v_personal, v_personal_version
  from public.atlas_user_preferences p
  where p.user_id = v_user;

  select coalesce(s.settings -> 'os', '{}'::jsonb), s.os_settings_version
  into v_organization, v_organization_version
  from public.organization_settings s
  where s.org_id = v_org;

  return jsonb_build_object(
    'organization_id', v_org,
    'role', v_role,
    'personal', public.normalize_os_user_settings(coalesce(v_personal, '{}'::jsonb)),
    'personal_version', coalesce(v_personal_version, 0),
    'organization', public.normalize_os_organization_settings(coalesce(v_organization, '{}'::jsonb)),
    'organization_version', coalesce(v_organization_version, 0),
    'external_delivery', jsonb_build_object(
      'windows', 'not_verified',
      'macos', 'not_verified',
      'ios', 'not_verified',
      'android', 'not_verified'
    )
  );
end;
$$;

create or replace function public.update_os_settings(
  p_scope text,
  p_settings jsonb,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_role text;
  v_current jsonb := '{}'::jsonb;
  v_current_version bigint := 0;
  v_normalized jsonb;
begin
  if v_user is null then
    raise exception 'authentication_required';
  end if;
  if p_scope not in ('user', 'organization') then
    raise exception 'invalid_scope';
  end if;
  if p_expected_version is null or p_expected_version < 0 then
    raise exception 'invalid_expected_version';
  end if;

  select c.org_id, c.role into v_org, v_role
  from public.resolve_os_settings_context() c;

  if v_org is null then
    raise exception 'no_active_organization';
  end if;

  if p_scope = 'user' then
    v_normalized := public.normalize_os_user_settings(coalesce(p_settings, '{}'::jsonb));

    select coalesce(p.preferences -> 'os', '{}'::jsonb), p.os_settings_version
    into v_current, v_current_version
    from public.atlas_user_preferences p
    where p.user_id = v_user
    for update;

    if not found then
      if p_expected_version <> 0 then raise exception 'version_conflict'; end if;
      insert into public.atlas_user_preferences(user_id, default_org_id, preferences, os_settings_version)
      values (v_user, v_org, jsonb_build_object('os', v_normalized), 1);
      v_current := '{}'::jsonb;
      v_current_version := 0;
    else
      if v_current_version <> p_expected_version then raise exception 'version_conflict'; end if;
      update public.atlas_user_preferences
      set preferences = jsonb_set(coalesce(preferences, '{}'::jsonb), '{os}', v_normalized, true),
          default_org_id = coalesce(default_org_id, v_org),
          os_settings_version = os_settings_version + 1,
          updated_at = now()
      where user_id = v_user;
    end if;
  else
    if v_role not in ('owner', 'admin') then
      raise exception 'settings_admin_required';
    end if;
    v_normalized := public.normalize_os_organization_settings(coalesce(p_settings, '{}'::jsonb));

    select coalesce(s.settings -> 'os', '{}'::jsonb), s.os_settings_version
    into v_current, v_current_version
    from public.organization_settings s
    where s.org_id = v_org
    for update;

    if not found then
      if p_expected_version <> 0 then raise exception 'version_conflict'; end if;
      insert into public.organization_settings(org_id, settings, os_settings_version)
      values (v_org, jsonb_build_object('os', v_normalized), 1);
      v_current := '{}'::jsonb;
      v_current_version := 0;
    else
      if v_current_version <> p_expected_version then raise exception 'version_conflict'; end if;
      update public.organization_settings
      set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{os}', v_normalized, true),
          os_settings_version = os_settings_version + 1,
          updated_at = now()
      where org_id = v_org;
    end if;
  end if;

  insert into public.audit_logs(org_id, user_id, action, table_name, record_id, old_data, new_data)
  values (
    v_org,
    v_user,
    'os.settings.update',
    case when p_scope = 'user' then 'atlas_user_preferences' else 'organization_settings' end,
    case when p_scope = 'user' then v_user::text else v_org::text end,
    v_current,
    v_normalized
  );

  return public.get_os_settings();
end;
$$;

grant execute on function public.resolve_os_settings_context() to authenticated;
grant execute on function public.get_os_settings() to authenticated;
grant execute on function public.update_os_settings(text, jsonb, bigint) to authenticated;
revoke execute on function public.resolve_os_settings_context() from anon;
revoke execute on function public.get_os_settings() from anon;
revoke execute on function public.update_os_settings(text, jsonb, bigint) from anon;
