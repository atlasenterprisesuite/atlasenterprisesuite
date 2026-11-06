-- KNOW-01: atomic Knowledge Atlas approval + supersession + shared audit.
-- Draft only. Require isolated PostgreSQL 17 and Supabase CLI migration checks before release.
-- This function is a single PostgreSQL transaction when invoked through PostgREST RPC.
-- Invoked with the server-authenticated actor and organization, never with client-supplied role.
begin;

create or replace function public.atlas_memory_approve_atomic(
  p_org_id uuid,
  p_actor_id uuid,
  p_record_id uuid
)
returns public.atlas_memory_records
language plpgsql
volatile
security invoker
set search_path = ''
as $atlas$
declare
  v_role text;
  v_record public.atlas_memory_records%rowtype;
  v_prior public.atlas_memory_records%rowtype;
  v_at timestamptz := pg_catalog.clock_timestamp();
begin
  if p_org_id is null or p_actor_id is null or p_record_id is null then
    raise exception 'memory_approval_scope_required' using errcode = 'P0001';
  end if;

  -- Lock active membership to serialize changes to role/status with this approval.
  -- SECURITY INVOKER + service_role-only EXECUTE; not callable by browser roles.
  select om.role into v_role
    from public.organization_members as om
   where om.org_id = p_org_id
     and om.user_id = p_actor_id
     and om.status = 'active'
   for share;

  if v_role is null or v_role not in ('owner', 'admin', 'platform_admin') then
    raise exception 'memory_approval_role_required' using errcode = 'P0001';
  end if;

  select r.* into v_record
    from public.atlas_memory_records as r
   where r.organization_id = p_org_id
     and r.id = p_record_id
   for update;

  if not found then
    raise exception 'memory_not_found' using errcode = 'P0001';
  end if;

  if v_record.status = 'approved' then
    return v_record; -- Idempotent: do not insert a second approval audit.
  end if;

  if v_record.status <> 'draft' then
    raise exception 'memory_not_approvable' using errcode = 'P0001';
  end if;

  if v_record.supersedes_id is not null then
    select r.* into v_prior
      from public.atlas_memory_records as r
     where r.organization_id = p_org_id
       and r.id = v_record.supersedes_id
     for update;

    if not found or v_prior.status <> 'approved' then
      raise exception 'memory_superseded_source_invalid' using errcode = 'P0001';
    end if;
  end if;

  update public.atlas_memory_records as r
     set status = 'approved',
         approved_by = p_actor_id,
         approved_at = v_at,
         updated_at = v_at,
         version = r.version + 1
   where r.organization_id = p_org_id
     and r.id = p_record_id
     and r.status = 'draft'
  returning r.* into v_record;

  if not found then
    raise exception 'memory_approval_conflict' using errcode = 'P0001';
  end if;

  if v_prior.id is not null then
    update public.atlas_memory_records as r
       set status = 'superseded',
           updated_at = v_at
     where r.organization_id = p_org_id
       and r.id = v_prior.id
       and r.status = 'approved';

    if not found then
      raise exception 'memory_supersession_conflict' using errcode = 'P0001';
    end if;
  end if;

  -- If audit insert fails, PostgreSQL rolls back *both* record updates.
  insert into public.audit_logs (
    org_id, user_id, action, table_name, record_id, new_data
  ) values (
    p_org_id,
    p_actor_id,
    'knowledge.memory.approved',
    'atlas_memory_records',
    p_record_id::text,
    pg_catalog.jsonb_build_object(
      'kind', v_record.kind,
      'source_type', v_record.source_type,
      'supersedes_id', v_record.supersedes_id
    )
  );

  return v_record;
end;
$atlas$;

-- Default function EXECUTE is granted to PUBLIC. Revoke in the same migration TX.
revoke execute on function public.atlas_memory_approve_atomic(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.atlas_memory_approve_atomic(uuid, uuid, uuid)
  to service_role;

commit;
