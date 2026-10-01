-- ATLAS Work OS closure: governed Forms + Drive foundations.
-- Board is a projection of canonical execution_workflows and does not create a parallel task model.

create table if not exists public.work_intake_forms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1200),
  owner_module text not null default 'work' check (char_length(owner_module) between 1 and 80),
  fields jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_intake_forms_fields_array check (jsonb_typeof(fields)='array')
);
create index if not exists work_intake_forms_org_updated_idx on public.work_intake_forms(org_id,updated_at desc);

create table if not exists public.work_form_submissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  form_id uuid not null references public.work_intake_forms(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb,
  submitted_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint work_form_submissions_payload_object check (jsonb_typeof(payload)='object')
);
create index if not exists work_form_submissions_org_form_created_idx on public.work_form_submissions(org_id,form_id,created_at desc);

create table if not exists public.atlas_drive_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null,
  file_name text not null check (char_length(btrim(file_name)) between 1 and 240),
  mime_type text not null default 'application/octet-stream' check (char_length(mime_type) between 1 and 160),
  size_bytes bigint not null check (size_bytes between 0 and 26214400),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  provenance jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(org_id,storage_path)
);
create index if not exists atlas_drive_files_org_created_idx on public.atlas_drive_files(org_id,created_at desc);

do $$
declare t text;
begin
  foreach t in array array['work_intake_forms','work_form_submissions','atlas_drive_files']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop trigger if exists %I_audit on public.%I',t,t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()',t,t);
  end loop;
end $$;

drop policy if exists work_intake_forms_read on public.work_intake_forms;
create policy work_intake_forms_read on public.work_intake_forms for select to authenticated
using (public.has_identity_permission(org_id,'execution.read') or public.has_identity_permission(org_id,'execution.write'));
drop policy if exists work_intake_forms_write on public.work_intake_forms;
create policy work_intake_forms_write on public.work_intake_forms for all to authenticated
using (public.has_identity_permission(org_id,'execution.write'))
with check (created_by=(select auth.uid()) and public.has_identity_permission(org_id,'execution.write'));

drop policy if exists work_form_submissions_read on public.work_form_submissions;
create policy work_form_submissions_read on public.work_form_submissions for select to authenticated
using (public.has_identity_permission(org_id,'execution.read') or public.has_identity_permission(org_id,'execution.write'));
drop policy if exists work_form_submissions_insert on public.work_form_submissions;
create policy work_form_submissions_insert on public.work_form_submissions for insert to authenticated
with check (
  submitted_by=(select auth.uid())
  and (public.has_identity_permission(org_id,'execution.read') or public.has_identity_permission(org_id,'execution.write'))
  and exists(select 1 from public.work_intake_forms f where f.id=form_id and f.org_id=org_id and f.active)
);

drop policy if exists atlas_drive_files_read on public.atlas_drive_files;
create policy atlas_drive_files_read on public.atlas_drive_files for select to authenticated
using (public.has_identity_permission(org_id,'execution.read') or public.has_identity_permission(org_id,'execution.write'));
drop policy if exists atlas_drive_files_insert on public.atlas_drive_files;
create policy atlas_drive_files_insert on public.atlas_drive_files for insert to authenticated
with check (created_by=(select auth.uid()) and public.has_identity_permission(org_id,'execution.write'));
drop policy if exists atlas_drive_files_delete on public.atlas_drive_files;
create policy atlas_drive_files_delete on public.atlas_drive_files for delete to authenticated
using (public.has_identity_permission(org_id,'execution.write'));

insert into storage.buckets(id,name,public,file_size_limit)
values('atlas-drive','atlas-drive',false,26214400)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit;

drop policy if exists atlas_drive_storage_read on storage.objects;
create policy atlas_drive_storage_read on storage.objects for select to authenticated
using (
  bucket_id='atlas-drive'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    then public.has_identity_permission(((storage.foldername(name))[1])::uuid,'execution.read')
      or public.has_identity_permission(((storage.foldername(name))[1])::uuid,'execution.write')
    else false
  end
);

drop policy if exists atlas_drive_storage_insert on storage.objects;
create policy atlas_drive_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id='atlas-drive'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    then public.has_identity_permission(((storage.foldername(name))[1])::uuid,'execution.write')
    else false
  end
);

drop policy if exists atlas_drive_storage_delete on storage.objects;
create policy atlas_drive_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id='atlas-drive'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    then public.has_identity_permission(((storage.foldername(name))[1])::uuid,'execution.write')
    else false
  end
);

grant select,insert,update,delete on public.work_intake_forms to authenticated;
grant select,insert on public.work_form_submissions to authenticated;
grant select,insert,delete on public.atlas_drive_files to authenticated;
