drop policy if exists atlas_incidents_read on public.atlas_incidents;
create policy atlas_incidents_read on public.atlas_incidents
for select to authenticated
using (
  (org_id is not null and public.has_identity_permission(org_id,'incidents.read'))
  or
  (org_id is null and exists (
    select 1 from public.organization_members m
    where m.user_id=(select auth.uid()) and m.status='active'
      and public.has_identity_permission(m.org_id,'runtime_verification.read')
  ))
);
