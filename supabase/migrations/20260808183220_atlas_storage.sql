-- ATLAS private document storage bucket and access policies.
-- Each object path must begin with the organization UUID:
--   <org_uuid>/<entity>/<entity_uuid>/<filename>

begin;

insert into storage.buckets (id, name, public, file_size_limit)
values ('atlas-documents', 'atlas-documents', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists atlas_documents_select on storage.objects;
create policy atlas_documents_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'atlas-documents'
  and public.is_org_member(public.try_uuid((storage.foldername(name))[1]))
);

drop policy if exists atlas_documents_insert on storage.objects;
create policy atlas_documents_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'atlas-documents'
  and public.can_write_business_data(public.try_uuid((storage.foldername(name))[1]))
);

drop policy if exists atlas_documents_update on storage.objects;
create policy atlas_documents_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'atlas-documents'
  and public.can_write_business_data(public.try_uuid((storage.foldername(name))[1]))
)
with check (
  bucket_id = 'atlas-documents'
  and public.can_write_business_data(public.try_uuid((storage.foldername(name))[1]))
);

drop policy if exists atlas_documents_delete on storage.objects;
create policy atlas_documents_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'atlas-documents'
  and public.has_org_role(
    public.try_uuid((storage.foldername(name))[1]),
    array['owner', 'admin']
  )
);

commit;
