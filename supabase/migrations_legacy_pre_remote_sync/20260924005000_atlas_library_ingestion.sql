-- ATLAS Library ingestion registry.
-- Stores durable, organization-scoped metadata and analysis copied from user-authorized Library sources.

create table if not exists public.atlas_library_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_system text not null default 'chatgpt_library' check (source_system in ('chatgpt_library','google_drive','dropbox','sharepoint','onedrive','box','atlas_upload')),
  source_file_id text not null,
  source_library_file_id text,
  source_version_id text,
  name text not null check (char_length(name) between 1 and 1024),
  library_path text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  source_created_at timestamptz,
  source_modified_at timestamptz,
  model_generated boolean,
  file_provider text,
  primary_module_id text not null default 'knowledge',
  module_ids text[] not null default array['knowledge']::text[],
  tags text[] not null default '{}'::text[],
  sensitivity text not null default 'organization' check (sensitivity in ('organization','restricted')),
  classification_basis text not null default 'fallback' check (classification_basis in ('path','name','content','manual','fallback')),
  analysis_status text not null default 'indexed' check (analysis_status in ('indexed','analyzed','duplicate','needs_review','error')),
  summary text not null default '' check (char_length(summary) <= 8000),
  content_excerpt text not null default '' check (char_length(content_excerpt) <= 20000),
  content_hash text,
  duplicate_of uuid references public.atlas_library_assets(id) on delete set null,
  memory_record_id uuid references public.atlas_memory_records(id) on delete set null,
  source_metadata jsonb not null default '{}'::jsonb,
  indexed_at timestamptz not null default now(),
  analyzed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (organization_id, source_system, source_file_id)
);

create index if not exists atlas_library_assets_org_module_idx
  on public.atlas_library_assets(organization_id, primary_module_id, updated_at desc);
create index if not exists atlas_library_assets_modules_gin_idx
  on public.atlas_library_assets using gin(module_ids);
create index if not exists atlas_library_assets_tags_gin_idx
  on public.atlas_library_assets using gin(tags);
create index if not exists atlas_library_assets_source_library_idx
  on public.atlas_library_assets(organization_id, source_library_file_id);
create index if not exists atlas_library_assets_name_size_idx
  on public.atlas_library_assets(organization_id, name, size_bytes);

alter table public.atlas_library_assets enable row level security;

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
      and om.user_id = auth.uid()
      and om.status = 'active'
      and (
        atlas_library_assets.sensitivity = 'organization'
        or om.role in ('owner','admin','platform_admin')
      )
  )
);

revoke all on public.atlas_library_assets from anon;
revoke insert, update, delete on public.atlas_library_assets from authenticated;
grant select on public.atlas_library_assets to authenticated;
grant all on public.atlas_library_assets to service_role;

comment on table public.atlas_library_assets is
  'Governed ATLAS Library registry. Source files remain provenance-linked; copied metadata and analysis are organization-scoped and module-routed.';
