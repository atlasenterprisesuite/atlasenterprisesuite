-- ATLAS Identity MFA step-up enforcement.
-- High-risk permission changes require an AAL2 session in addition to owner/admin role checks.
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
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'ATLAS Identity requires MFA step-up (AAL2) for permission changes';
  end if;

  if not public.has_org_role(organization_id, array['owner','admin']) then
    raise exception 'Identity administration permission required';
  end if;

  if target_role not in ('owner','admin','accountant','manager','staff','viewer') then
    raise exception 'Unsupported organization role';
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
      'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
    )
  );
end;
$$;

revoke execute on function public.set_identity_role_permission(uuid,text,text,boolean) from public, anon;
grant execute on function public.set_identity_role_permission(uuid,text,text,boolean) to authenticated;

commit;
