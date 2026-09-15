-- ATLAS Native Improvement Engine: os.settings P1
-- Identity is derived from auth.uid(); browser-supplied tenant identifiers are not accepted.

create table if not exists public.os_user_settings (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists public.os_organization_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.os_settings_audit (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('user', 'organization')),
  action text not null check (action in ('settings.update')),
  before_state jsonb,
  after_state jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists os_settings_audit_org_created_idx
  on public.os_settings_audit (org_id, created_at desc);
create index if not exists os_settings_audit_user_created_idx
  on public.os_settings_audit (user_id, created_at desc);

alter table public.os_user_settings enable row level security;
alter table public.os_organization_settings enable row level security;
alter table public.os_settings_audit enable row level security;

revoke insert, update, delete on public.os_user_settings from authenticated;
revoke insert, update, delete on public.os_organization_settings from authenticated;
revoke insert, update, delete on public.os_settings_audit from authenticated;
grant select on public.os_user_settings, public.os_organization_settings, public.os_settings_audit to authenticated;

create policy os_user_settings_read_own
on public.os_user_settings for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.organization_members om
    where om.org_id = os_user_settings.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

create policy os_organization_settings_member_read
on public.os_organization_settings for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = os_organization_settings.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

create policy os_settings_audit_read
on public.os_settings_audit for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = os_settings_audit.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and (
        os_settings_audit.user_id = (select auth.uid())
        or om.role in ('owner', 'admin')
      )
  )
);

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

  select om.org_id, om.role
  into v_org, v_role
  from public.organization_members om
  where om.user_id = v_user and om.status = 'active'
  order by om.org_id
  limit 1;

  if v_org is null then
    raise exception 'no_active_organization';
  end if;

  select s.settings, s.version
  into v_personal, v_personal_version
  from public.os_user_settings s
  where s.org_id = v_org and s.user_id = v_user;

  select s.settings, s.version
  into v_organization, v_organization_version
  from public.os_organization_settings s
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
  v_current jsonb;
  v_current_version bigint;
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

  select om.org_id, om.role
  into v_org, v_role
  from public.organization_members om
  where om.user_id = v_user and om.status = 'active'
  order by om.org_id
  limit 1;

  if v_org is null then
    raise exception 'no_active_organization';
  end if;

  if p_scope = 'user' then
    v_normalized := public.normalize_os_user_settings(coalesce(p_settings, '{}'::jsonb));
    select settings, version into v_current, v_current_version
    from public.os_user_settings
    where org_id = v_org and user_id = v_user
    for update;

    if not found then
      if p_expected_version <> 0 then raise exception 'version_conflict'; end if;
      insert into public.os_user_settings(org_id, user_id, settings, version)
      values (v_org, v_user, v_normalized, 1);
    else
      if v_current_version <> p_expected_version then raise exception 'version_conflict'; end if;
      update public.os_user_settings
      set settings = v_normalized, version = version + 1, updated_at = now()
      where org_id = v_org and user_id = v_user;
    end if;
  else
    if v_role not in ('owner', 'admin') then
      raise exception 'settings_admin_required';
    end if;
    v_normalized := public.normalize_os_organization_settings(coalesce(p_settings, '{}'::jsonb));
    select settings, version into v_current, v_current_version
    from public.os_organization_settings
    where org_id = v_org
    for update;

    if not found then
      if p_expected_version <> 0 then raise exception 'version_conflict'; end if;
      insert into public.os_organization_settings(org_id, settings, version, updated_by)
      values (v_org, v_normalized, 1, v_user);
    else
      if v_current_version <> p_expected_version then raise exception 'version_conflict'; end if;
      update public.os_organization_settings
      set settings = v_normalized, version = version + 1, updated_by = v_user, updated_at = now()
      where org_id = v_org;
    end if;
  end if;

  insert into public.os_settings_audit(org_id, user_id, scope, action, before_state, after_state)
  values (v_org, v_user, p_scope, 'settings.update', v_current, v_normalized);

  return public.get_os_settings();
end;
$$;

grant execute on function public.get_os_settings() to authenticated;
grant execute on function public.update_os_settings(text, jsonb, bigint) to authenticated;
revoke execute on function public.get_os_settings() from anon;
revoke execute on function public.update_os_settings(text, jsonb, bigint) from anon;
