create or replace function atlas_private.is_platform_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select exists (
    select 1 from public.atlas_platform_admins p
    where p.user_id=p_user_id and p.enabled is true
  );
$$;

revoke all on function atlas_private.is_platform_admin(uuid) from public,anon,authenticated;
grant execute on function atlas_private.is_platform_admin(uuid) to authenticated,service_role;

drop policy if exists atlas_incidents_read on public.atlas_incidents;
create policy atlas_incidents_read on public.atlas_incidents
for select to authenticated
using (
  ((org_id is not null) and public.has_identity_permission(org_id,'incidents.read'))
  or
  ((org_id is null) and atlas_private.is_platform_admin((select auth.uid())))
);
