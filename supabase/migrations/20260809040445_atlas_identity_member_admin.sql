-- ATLAS Identity member administration hardening.
-- Removes direct membership writes and routes role/status mutations through audited AAL2 RPCs.
begin;

create or replace function public.list_identity_members(organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_identity_permission(organization_id, 'members.read') then
    raise exception 'Member read permission required';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'user_id', membership.user_id,
          'full_name', profile.full_name,
          'role', membership.role,
          'status', membership.status,
          'created_at', membership.created_at,
          'updated_at', membership.updated_at
        )
        order by
          case membership.role
            when 'owner' then 1
            when 'admin' then 2
            when 'accountant' then 3
            when 'manager' then 4
            when 'staff' then 5
            else 6
          end,
          coalesce(profile.full_name, membership.user_id::text)
      )
      from public.organization_members membership
      left join public.profiles profile on profile.id = membership.user_id
      where membership.org_id = organization_id
    ),
    '[]'::jsonb
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

  select role into actor_role
  from public.organization_members
  where org_id = organization_id
    and user_id = auth.uid()
    and status = 'active';

  if actor_role not in ('owner','admin') then
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

  select role into actor_role
  from public.organization_members
  where org_id = organization_id
    and user_id = auth.uid()
    and status = 'active';

  if actor_role not in ('owner','admin') then
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
      'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
    )
  );
end;
$$;

drop policy if exists member_manage on public.organization_members;
revoke insert, update, delete on public.organization_members from authenticated;

grant select on public.organization_members to authenticated;

revoke execute on function public.list_identity_members(uuid) from public, anon;
revoke execute on function public.set_identity_member_role(uuid,uuid,text) from public, anon;
revoke execute on function public.set_identity_member_status(uuid,uuid,text) from public, anon;

grant execute on function public.list_identity_members(uuid) to authenticated;
grant execute on function public.set_identity_member_role(uuid,uuid,text) to authenticated;
grant execute on function public.set_identity_member_status(uuid,uuid,text) to authenticated;

commit;
