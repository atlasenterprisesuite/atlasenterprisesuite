-- Knowledge Atlas advisor cleanup.
-- Adds covering indexes for Library foreign keys and avoids per-row auth.uid() re-evaluation in RLS.

create index if not exists atlas_library_assets_duplicate_of_idx
  on public.atlas_library_assets(duplicate_of)
  where duplicate_of is not null;

create index if not exists atlas_library_assets_memory_record_id_idx
  on public.atlas_library_assets(memory_record_id)
  where memory_record_id is not null;

drop policy if exists atlas_library_assets_org_read on public.atlas_library_assets;
create policy atlas_library_assets_org_read
on public.atlas_library_assets
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.org_id = atlas_library_assets.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and (
        atlas_library_assets.sensitivity = 'organization'
        or om.role in ('owner','admin','platform_admin')
      )
  )
);

drop policy if exists "atlas_memory_org_read" on public.atlas_memory_records;
create policy "atlas_memory_org_read"
on public.atlas_memory_records
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.org_id = atlas_memory_records.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and (
        atlas_memory_records.sensitivity = 'organization'
        or om.role in ('owner','admin','platform_admin')
      )
  )
);
