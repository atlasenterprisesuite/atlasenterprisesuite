-- Knowledge Atlas audit hardening.
-- Server-side search/pagination and role-aware aggregate statistics.
-- Functions are callable only by service_role through the atlas-memory edge boundary.

create or replace function public.atlas_memory_search(
  p_org_id uuid,
  p_role text,
  p_q text default '',
  p_kind text default '',
  p_status text default '',
  p_module text default '',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  organization_id uuid,
  created_by uuid,
  approved_by uuid,
  kind text,
  status text,
  title text,
  summary text,
  content_json jsonb,
  source_type text,
  source_ref text,
  module_ids text[],
  tags text[],
  sensitivity text,
  version integer,
  supersedes_id uuid,
  approved_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select r.*
    from public.atlas_memory_records r
    where r.organization_id = p_org_id
      and (p_role in ('owner','admin','platform_admin') or r.sensitivity = 'organization')
      and (nullif(trim(p_kind), '') is null or r.kind = trim(p_kind))
      and (nullif(trim(p_status), '') is null or r.status = trim(p_status))
      and (nullif(trim(p_module), '') is null or r.module_ids @> array[trim(p_module)]::text[])
      and (
        nullif(trim(p_q), '') is null
        or position(
          lower(trim(p_q)) in lower(
            concat_ws(' ',
              r.title,
              r.summary,
              array_to_string(r.tags, ' '),
              array_to_string(r.module_ids, ' ')
            )
          )
        ) > 0
      )
  )
  select
    r.id, r.organization_id, r.created_by, r.approved_by, r.kind, r.status,
    r.title, r.summary, r.content_json, r.source_type, r.source_ref,
    r.module_ids, r.tags, r.sensitivity, r.version, r.supersedes_id,
    r.approved_at, r.created_at, r.updated_at,
    count(*) over() as total_count
  from filtered r
  order by r.updated_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.atlas_memory_stats(
  p_org_id uuid,
  p_role text,
  p_module text default ''
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with visible as (
    select status
    from public.atlas_memory_records r
    where r.organization_id = p_org_id
      and (p_role in ('owner','admin','platform_admin') or r.sensitivity = 'organization')
      and (nullif(trim(p_module), '') is null or r.module_ids @> array[trim(p_module)]::text[])
  )
  select jsonb_build_object(
    'total_records', count(*),
    'approved', count(*) filter (where status = 'approved'),
    'draft', count(*) filter (where status = 'draft'),
    'superseded', count(*) filter (where status = 'superseded')
  )
  from visible;
$$;

create or replace function public.atlas_library_search(
  p_org_id uuid,
  p_role text,
  p_q text default '',
  p_module text default '',
  p_analysis_status text default '',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  organization_id uuid,
  source_system text,
  source_file_id text,
  source_library_file_id text,
  source_version_id text,
  name text,
  library_path text,
  mime_type text,
  size_bytes bigint,
  source_created_at timestamptz,
  source_modified_at timestamptz,
  model_generated boolean,
  file_provider text,
  primary_module_id text,
  module_ids text[],
  tags text[],
  sensitivity text,
  classification_basis text,
  analysis_status text,
  summary text,
  content_excerpt text,
  content_hash text,
  duplicate_of uuid,
  memory_record_id uuid,
  source_metadata jsonb,
  indexed_at timestamptz,
  analyzed_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select a.*
    from public.atlas_library_assets a
    where a.organization_id = p_org_id
      and (p_role in ('owner','admin','platform_admin') or a.sensitivity = 'organization')
      and (nullif(trim(p_module), '') is null or a.module_ids @> array[trim(p_module)]::text[])
      and (nullif(trim(p_analysis_status), '') is null or a.analysis_status = trim(p_analysis_status))
      and (
        nullif(trim(p_q), '') is null
        or position(
          lower(trim(p_q)) in lower(
            concat_ws(' ',
              a.name,
              a.library_path,
              a.primary_module_id,
              a.summary,
              array_to_string(a.tags, ' '),
              array_to_string(a.module_ids, ' ')
            )
          )
        ) > 0
      )
  )
  select
    a.id, a.organization_id, a.source_system, a.source_file_id, a.source_library_file_id,
    a.source_version_id, a.name, a.library_path, a.mime_type, a.size_bytes,
    a.source_created_at, a.source_modified_at, a.model_generated, a.file_provider,
    a.primary_module_id, a.module_ids, a.tags, a.sensitivity, a.classification_basis,
    a.analysis_status, a.summary, a.content_excerpt, a.content_hash, a.duplicate_of,
    a.memory_record_id, a.source_metadata, a.indexed_at, a.analyzed_at, a.updated_at,
    count(*) over() as total_count
  from filtered a
  order by a.updated_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.atlas_library_stats(
  p_org_id uuid,
  p_role text,
  p_module text default ''
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with visible as (
    select a.*
    from public.atlas_library_assets a
    where a.organization_id = p_org_id
      and (p_role in ('owner','admin','platform_admin') or a.sensitivity = 'organization')
      and (nullif(trim(p_module), '') is null or a.module_ids @> array[trim(p_module)]::text[])
  ),
  module_counts as (
    select coalesce(primary_module_id, 'knowledge') as key, count(*) as value
    from visible group by 1
  ),
  status_counts as (
    select analysis_status as key, count(*) as value
    from visible group by 1
  )
  select jsonb_build_object(
    'total_assets', (select count(*) from visible),
    'total_bytes', coalesce((select sum(size_bytes) from visible), 0),
    'restricted_assets', case
      when p_role in ('owner','admin','platform_admin')
        then (select count(*) from visible where sensitivity = 'restricted')
      else 0
    end,
    'by_module', coalesce((select jsonb_object_agg(key, value) from module_counts), '{}'::jsonb),
    'by_status', coalesce((select jsonb_object_agg(key, value) from status_counts), '{}'::jsonb)
  );
$$;

revoke all on function public.atlas_memory_search(uuid,text,text,text,text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.atlas_memory_stats(uuid,text,text) from public, anon, authenticated;
revoke all on function public.atlas_library_search(uuid,text,text,text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.atlas_library_stats(uuid,text,text) from public, anon, authenticated;

grant execute on function public.atlas_memory_search(uuid,text,text,text,text,text,integer,integer) to service_role;
grant execute on function public.atlas_memory_stats(uuid,text,text) to service_role;
grant execute on function public.atlas_library_search(uuid,text,text,text,text,integer,integer) to service_role;
grant execute on function public.atlas_library_stats(uuid,text,text) to service_role;
