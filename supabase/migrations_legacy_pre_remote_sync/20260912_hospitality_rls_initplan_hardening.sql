drop policy if exists hospitality_provider_instances_member_read on public.hospitality_provider_instances;
create policy hospitality_provider_instances_member_read
on public.hospitality_provider_instances
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.org_id = hospitality_provider_instances.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists hospitality_room_mappings_member_read on public.hospitality_room_mappings;
create policy hospitality_room_mappings_member_read
on public.hospitality_room_mappings
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.org_id = hospitality_room_mappings.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists hospitality_credential_references_member_read on public.hospitality_credential_references;
create policy hospitality_credential_references_member_read
on public.hospitality_credential_references
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.org_id = hospitality_credential_references.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);
