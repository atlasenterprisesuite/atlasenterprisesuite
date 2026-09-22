-- ATLAS Memory / Knowledge Layer
-- Organization-scoped durable memory for approved product knowledge.
-- Browser clients may read through RLS but all writes flow through atlas-memory.

create table if not exists public.atlas_memory_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('decision','requirement','workflow','configuration','evidence','note')),
  status text not null default 'draft' check (status in ('draft','approved','superseded')),
  title text not null check (char_length(title) between 1 and 240),
  summary text not null default '' check (char_length(summary) <= 4000),
  content_json jsonb not null default '{}'::jsonb,
  source_type text not null check (source_type in ('atlas','chat_import','document','user_entry','system_event')),
  source_ref text check (source_ref is null or char_length(source_ref) <= 1000),
  source_hash text check (source_hash is null or char_length(source_hash) <= 128),
  module_ids text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  sensitivity text not null default 'organization' check (sensitivity in ('organization','restricted')),
  version integer not null default 1 check (version > 0),
  supersedes_id uuid references public.atlas_memory_records(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'approved' and approved_at is not null and approved_by is not null) or status <> 'approved')
);

create index if not exists atlas_memory_records_org_updated_idx
  on public.atlas_memory_records(organization_id, updated_at desc);
create index if not exists atlas_memory_records_org_status_kind_idx
  on public.atlas_memory_records(organization_id, status, kind);
create index if not exists atlas_memory_records_modules_gin_idx
  on public.atlas_memory_records using gin(module_ids);
create index if not exists atlas_memory_records_tags_gin_idx
  on public.atlas_memory_records using gin(tags);
create unique index if not exists atlas_memory_records_source_hash_uidx
  on public.atlas_memory_records(organization_id, source_type, source_hash)
  where source_hash is not null;

alter table public.atlas_memory_records enable row level security;

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
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

revoke all on table public.atlas_memory_records from anon;
revoke insert, update, delete on table public.atlas_memory_records from authenticated;
grant select on table public.atlas_memory_records to authenticated;

comment on table public.atlas_memory_records is
  'Governed ATLAS organizational memory. Imported chat content remains draft unless explicitly approved.';
