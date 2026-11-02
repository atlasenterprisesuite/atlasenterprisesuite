-- ATLAS Identity hierarchy and concurrency hardening.
-- Effective permissions are enforced server-side, admins cannot alter owner/admin policy,
-- and organization-scoped advisory locks protect the last-active-owner invariant.
begin;

create or replace function public.set_identity_role_permission(
  organization_id uuid,
  target_role text,
  target_permission text,
  allow_permission boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'ATLAS Identity requires MFA step-up (AAL2) for permission changes';
  end if;

  select role into actor_role
  from public.organization_members
  where org_id = organization_id
    and user_id = auth.uid()
    and status = 'active';

  if actor_role not in ('owner','admin')
     or not public.has_identity_permission(organization_id, 'identity.manage') then
    raise exception 'Identity administration permission required';
  end if;

  if target_role not in ('owner','admin','accountant','manager','staff','viewer') then
    raise exception 'Unsupported organization role';
  end if;

  if actor_role = 'admin' and target_role in ('owner','admin') then
    raise exception 'Only an owner can manage owner or admin permissions';
  end if;

  if target_role = 'owner'
     and target_permission = 'identity.manage'
     and allow_permission = false then
    raise exception 'Owner identity.manage permission cannot be denied';
  end if;

  if not exists (select 1 from public.identity_permissions where code = target_permission) then
    raise exception 'Unknown identity permission';
  end if;

  insert into public.organization_role_permissions(org_id, role, permission_code, allowed, updated_by)
  values (organization_id, target_role, target_permission, allow_permission, auth.uid())
  on conflict (org_id, role, permission_code)
  do update set allowed = excluded.allowed, updated_by = auth.uid(), updated_at = now();

  insert into public.identity_security_events(org_id, actor_user_id, event_type, metadata)
  values (
    organization_id,
    auth.uid(),
    'role_permission_changed',
    jsonb_build_object(
      'role', target_role,
      'permission', target_permission,
      'allowed', allow_permission,
      'actor_role', actor_role,
      'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
    )
  );
end;
$$;

create or replace function public.set_identity_member_role(
  organization_id uuid,
  target_user_id uuid,
  target_role text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
  previous_role text;
  active_owner_count integer;
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'ATLAS Identity requires MFA step-up (AAL2) for member role changes';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(organization_id::text, 0));

  select role into actor_role
  from public.organization_members
  where org_id = organization_id
    and user_id = auth.uid()
    and status = 'active';

  if actor_role not in ('owner','admin')
     or not public.has_identity_permission(organization_id, 'members.manage') then
    raise exception 'Member administration permission required';
  end if;

  if target_role not in ('owner','admin','accountant','manager','staff','viewer') then
    raise exception 'Unsupported organization role';
  end if;

  select role into previous_role
  from public.organization_members
  where org_id = organization_id
    and user_id = target_user_id
  for update;

  if previous_role is null then
    raise exception 'Target member does not exist in this organization';
  end if;

  if actor_role = 'admin' and (previous_role in ('owner','admin') or target_role in ('owner','admin')) then
    raise exception 'Only an owner can manage owner or admin roles';
  end if;

  if previous_role = 'owner' and target_role <> 'owner' then
    select count(*) into active_owner_count
    from public.organization_members
    where org_id = organization_id
      and role = 'owner'
      and status = 'active';

    if active_owner_count <= 1 then
      raise exception 'The organization must retain at least one active owner';
    end if;
  end if;

  update public.organization_members
  set role = target_role,
      updated_at = now()
  where org_id = organization_id
    and user_id = target_user_id;

  insert into public.identity_security_events(org_id, actor_user_id, event_type, metadata)
  values (
    organization_id,
    auth.uid(),
    'member_role_changed',
    jsonb_build_object(
      'target_user_id', target_user_id,
      'previous_role', previous_role,
      'role', target_role,
      'actor_role', actor_role,
      'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
    )
  );
end;
$$;

create or replace function public.set_identity_member_status(
  organization_id uuid,
  target_user_id uuid,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
  target_member_role text;
  previous_status text;
  active_owner_count integer;
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'ATLAS Identity requires MFA step-up (AAL2) for member status changes';
  end if;

  if target_status not in ('active','suspended') then
    raise exception 'Unsupported member status';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(organization_id::text, 0));

  select role into actor_role
  from public.organization_members
  where org_id = organization_id
    and user_id = auth.uid()
    and status = 'active';

  if actor_role not in ('owner','admin')
     or not public.has_identity_permission(organization_id, 'members.manage') then
    raise exception 'Member administration permission required';
  end if;

  select role, status into target_member_role, previous_status
  from public.organization_members
  where org_id = organization_id
    and user_id = target_user_id
  for update;

  if target_member_role is null then
    raise exception 'Target member does not exist in this organization';
  end if;

  if actor_role = 'admin' and target_member_role in ('owner','admin') then
    raise exception 'Only an owner can change owner or admin status';
  end if;

  if target_member_role = 'owner' and previous_status = 'active' and target_status <> 'active' then
    select count(*) into active_owner_count
    from public.organization_members
    where org_id = organization_id
      and role = 'owner'
      and status = 'active';

    if active_owner_count <= 1 then
      raise exception 'The organization must retain at least one active owner';
    end if;
  end if;

  update public.organization_members
  set status = target_status,
      updated_at = now()
  where org_id = organization_id
    and user_id = target_user_id;

  insert into public.identity_security_events(org_id, actor_user_id, event_type, metadata)
  values (
    organization_id,
    auth.uid(),
    'member_status_changed',
    jsonb_build_object(
      'target_user_id', target_user_id,
      'role', target_member_role,
      'previous_status', previous_status,
      'status', target_status,
      'actor_role', actor_role,
      'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
    )
  );
end;
$$;

revoke execute on function public.set_identity_role_permission(uuid,text,text,boolean) from public, anon;
revoke execute on function public.set_identity_member_role(uuid,uuid,text) from public, anon;
revoke execute on function public.set_identity_member_status(uuid,uuid,text) from public, anon;

grant execute on function public.set_identity_role_permission(uuid,text,text,boolean) to authenticated;
grant execute on function public.set_identity_member_role(uuid,uuid,text) to authenticated;
grant execute on function public.set_identity_member_status(uuid,uuid,text) to authenticated;

commit;
