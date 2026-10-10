drop policy if exists atlas_runtime_verification_runs_read on public.atlas_runtime_verification_runs;
create policy atlas_runtime_verification_runs_read on public.atlas_runtime_verification_runs
for select to authenticated
using (
  (organization_id is not null and public.has_identity_permission(organization_id,'runtime_verification.read'))
  or
  (organization_id is null and exists (
    select 1 from public.organization_members m
    where m.user_id=(select auth.uid()) and m.status='active'
      and public.has_identity_permission(m.org_id,'runtime_verification.read')
  ))
);
