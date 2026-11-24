-- ATLAS 777 REVIEW: atomic, resumable, audited organization memory imports.
-- A single PostgREST RPC statement is one PostgreSQL transaction. If any
-- record or audit event fails, the complete batch rolls back (fail-closed).
-- Only the authenticated atlas-memory Edge service role may invoke it.

create or replace function public.atlas_memory_import_drafts(
  p_org_id uuid,
  p_user_id uuid,
  p_records jsonb
)
returns setof public.atlas_memory_records
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_record public.atlas_memory_records%rowtype;
  v_inserted boolean;
  v_new_count integer := 0;
  v_total integer;
begin
  if p_org_id is null or p_user_id is null
     or jsonb_typeof(p_records) is distinct from 'array' then
    raise exception 'memory_import_invalid_arguments' using errcode = '22023';
  end if;

  v_total := jsonb_array_length(p_records);
  if v_total < 1 or v_total > 50 then
    raise exception 'memory_import_batch_limit' using errcode = '22023';
  end if;

  -- Recheck authorization at the database boundary (defense in depth).
  if not exists (
    select 1 from public.organization_members om
    where om.org_id = p_org_id
      and om.user_id = p_user_id
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'platform_admin')
  ) then
    raise exception 'memory_import_role_denied' using errcode = '42501';
  end if;

  for v_item in select value from jsonb_array_elements(p_records)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or v_item->>'status' is distinct from 'draft'
       or coalesce(v_item->>'source_hash', '') !~ '^[0-9a-f]{64}$'
       or (v_item->>'source_type' = 'chat_import' and nullif(v_item->>'source_ref', '') is null) then
      raise exception 'memory_import_invalid_draft' using errcode = '22023';
    end if;

    v_record := null;
    insert into public.atlas_memory_records (
      organization_id, created_by, kind, status, title, summary, content_json,
      source_type, source_ref, source_hash, module_ids, tags, sensitivity, version
    )
    values (
      p_org_id, p_user_id, v_item->>'kind', 'draft', v_item->>'title',
      coalesce(v_item->>'summary', ''),
      coalesce(v_item->'content_json', '{}'::jsonb),
      v_item->>'source_type', nullif(v_item->>'source_ref', ''),
      v_item->>'source_hash',
      array(select jsonb_array_elements_text(coalesce(v_item->'module_ids', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(v_item->'tags', '[]'::jsonb))),
      coalesce(v_item->>'sensitivity', 'restricted'), 1
    )
    on conflict (organization_id, source_type, source_hash)
      where source_hash is not null
      do nothing
    returning * into v_record;

    v_inserted := found;
    if not v_inserted then
      select * into v_record
      from public.atlas_memory_records
      where organization_id = p_org_id
        and source_type = v_item->>'source_type'
        and source_hash = v_item->>'source_hash';

      if not found
         or v_record.title is distinct from v_item->>'title'
         or v_record.kind is distinct from v_item->>'kind'
         or v_record.summary is distinct from coalesce(v_item->>'summary', '')
         or v_record.content_json is distinct from coalesce(v_item->'content_json', '{}'::jsonb)
         or v_record.source_ref is distinct from nullif(v_item->>'source_ref', '')
         or v_record.module_ids is distinct from
            array(select jsonb_array_elements_text(coalesce(v_item->'module_ids', '[]'::jsonb)))
         or v_record.tags is distinct from
            array(select jsonb_array_elements_text(coalesce(v_item->'tags', '[]'::jsonb)))
         or v_record.sensitivity is distinct from coalesce(v_item->>'sensitivity', 'restricted') then
        raise exception 'memory_import_source_hash_conflict' using errcode = '23505';
      end if;
    else
      insert into public.audit_logs(org_id, user_id, action, table_name, record_id, new_data)
      values (
        p_org_id, p_user_id, 'knowledge.memory.created', 'atlas_memory_records', v_record.id::text,
        jsonb_build_object(
          'source_type', v_record.source_type,
          'source_hash', v_record.source_hash,
          'module_ids', v_record.module_ids,
          'sensitivity', v_record.sensitivity,
          'status', 'draft'
        )
      );
      v_new_count := v_new_count + 1;
    end if;
    return next v_record;
  end loop;

  insert into public.audit_logs(org_id, user_id, action, table_name, record_id, new_data)
  values (
    p_org_id, p_user_id, 'knowledge.memory.imported', 'atlas_memory_records', null,
    jsonb_build_object('count', v_total, 'new_records', v_new_count,
                       'replayed_records', v_total - v_new_count, 'approved', false)
  );
  return;
end;
$$;

revoke all on function public.atlas_memory_import_drafts(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.atlas_memory_import_drafts(uuid, uuid, jsonb)
  to service_role;

comment on function public.atlas_memory_import_drafts(uuid, uuid, jsonb) is
  'ATLAS 777: atomic import of draft-only memory with hash replay and in-transaction audit. Never auto-approves chat history.';

-- Approval, supersession and audit also commit or roll back as one transaction.
create or replace function public.atlas_memory_approve_draft(
  p_org_id uuid,
  p_user_id uuid,
  p_record_id uuid,
  p_expected_version integer,
  p_reviewed boolean default false
)
returns public.atlas_memory_records
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_record public.atlas_memory_records%rowtype;
  v_superseded uuid;
begin
  if p_org_id is null or p_user_id is null or p_record_id is null
     or p_expected_version is null or p_expected_version < 1 then
    raise exception 'memory_approval_invalid_arguments' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.organization_members om
    where om.org_id = p_org_id
      and om.user_id = p_user_id
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'platform_admin')
  ) then
    raise exception 'memory_approval_role_denied' using errcode = '42501';
  end if;

  select * into v_record
  from public.atlas_memory_records
  where organization_id = p_org_id and id = p_record_id
  for update;

  if not found then
    raise exception 'memory_not_found' using errcode = 'P0002';
  end if;

  if v_record.status = 'approved' then
    return v_record; -- idempotent after a confirmed approval
  end if;
  if v_record.status <> 'draft' then
    raise exception 'memory_not_approvable' using errcode = '23514';
  end if;
  if v_record.version <> p_expected_version then
    raise exception 'memory_approval_stale_version' using errcode = '40001';
  end if;
  if v_record.source_type = 'chat_import' and p_reviewed is distinct from true then
    raise exception 'memory_chat_review_required' using errcode = '42501';
  end if;

  update public.atlas_memory_records
  set status = 'approved',
      approved_by = p_user_id,
      approved_at = now(),
      updated_at = now(),
      version = version + 1
  where organization_id = p_org_id and id = p_record_id
  returning * into v_record;

  if v_record.supersedes_id is not null then
    update public.atlas_memory_records
    set status = 'superseded', updated_at = now(), version = version + 1
    where organization_id = p_org_id
      and id = v_record.supersedes_id
      and status = 'approved'
    returning id into v_superseded;

    if v_superseded is null then
      raise exception 'memory_superseded_record_invalid' using errcode = '23514';
    end if;

    insert into public.audit_logs(org_id, user_id, action, table_name, record_id, new_data)
    values (
      p_org_id, p_user_id, 'knowledge.memory.superseded',
      'atlas_memory_records', v_superseded::text,
      jsonb_build_object('superseded_by', v_record.id, 'status', 'superseded')
    );
  end if;

  insert into public.audit_logs(org_id, user_id, action, table_name, record_id, new_data)
  values (
    p_org_id, p_user_id, 'knowledge.memory.approved',
    'atlas_memory_records', v_record.id::text,
    jsonb_build_object(
      'kind', v_record.kind,
      'source_type', v_record.source_type,
      'supersedes_id', v_record.supersedes_id,
      'version', v_record.version,
      'explicit_chat_review', p_reviewed
    )
  );
  return v_record;
end;
$$;

revoke all on function public.atlas_memory_approve_draft(uuid, uuid, uuid, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.atlas_memory_approve_draft(uuid, uuid, uuid, integer, boolean)
  to service_role;

comment on function public.atlas_memory_approve_draft(uuid, uuid, uuid, integer, boolean) is
  'ATLAS 777: version-checked, one-transaction approval, supersession and audit.';
