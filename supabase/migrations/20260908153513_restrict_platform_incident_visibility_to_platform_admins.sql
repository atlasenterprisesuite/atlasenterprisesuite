drop policy if exists atlas_incidents_read on public.atlas_incidents;
create policy atlas_incidents_read on public.atlas_incidents
for select to authenticated
using (
  ((org_id is not null) and public.has_identity_permission(org_id,'incidents.read'))
  or
  ((org_id is null) and exists (
    select 1
    from public.atlas_platform_admins p
    where p.user_id=(select auth.uid()) and p.enabled is true
  ))
);
