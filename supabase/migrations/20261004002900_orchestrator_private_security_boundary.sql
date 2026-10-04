-- Move privileged orchestrator persistence behind a non-exposed schema.
-- Public PostgREST RPCs remain token-gated compatibility wrappers, but run as
-- SECURITY INVOKER so they cannot bypass RLS directly. The private helpers
-- retain SECURITY DEFINER and validate x-atlas-runtime-token against Vault.

create or replace function private.atlas_orchestrator_create_task_internal(
  p_tenant_id text,
  p_organization_id text,
  p_task_id text,
  p_schema_version integer,
  p_state text,
  p_task_json jsonb,
  p_created_at timestamptz,
  p_updated_at timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.atlas_orchestrator_runtime_authorized() then
    raise insufficient_privilege using message = 'atlas_orchestrator_runtime_unauthorized';
  end if;

  insert into public.atlas_orchestrator_tasks (
    tenant_id, organization_id, task_id, schema_version, state,
    task_json, created_at, updated_at
  ) values (
    p_tenant_id, p_organization_id, p_task_id, p_schema_version, p_state,
    p_task_json, p_created_at, p_updated_at
  );
end;
$$;

create or replace function private.atlas_orchestrator_get_task_internal(
  p_tenant_id text,
  p_organization_id text,
  p_task_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.atlas_orchestrator_runtime_authorized() then
    raise insufficient_privilege using message = 'atlas_orchestrator_runtime_unauthorized';
  end if;

  select task_json into result
  from public.atlas_orchestrator_tasks
  where tenant_id = p_tenant_id
    and organization_id = p_organization_id
    and task_id = p_task_id
  limit 1;

  return result;
end;
$$;

create or replace function private.atlas_orchestrator_save_task_internal(
  p_tenant_id text,
  p_organization_id text,
  p_task_id text,
  p_schema_version integer,
  p_state text,
  p_task_json jsonb,
  p_updated_at timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.atlas_orchestrator_runtime_authorized() then
    raise insufficient_privilege using message = 'atlas_orchestrator_runtime_unauthorized';
  end if;

  update public.atlas_orchestrator_tasks
  set schema_version = p_schema_version,
      state = p_state,
      task_json = p_task_json,
      updated_at = p_updated_at
  where tenant_id = p_tenant_id
    and organization_id = p_organization_id
    and task_id = p_task_id;

  if not found then
    raise no_data_found using message = 'atlas_orchestrator_task_not_found';
  end if;
end;
$$;

create or replace function private.atlas_orchestrator_append_event_internal(
  p_id text,
  p_tenant_id text,
  p_organization_id text,
  p_task_id text,
  p_event_type text,
  p_event_json jsonb,
  p_occurred_at timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.atlas_orchestrator_runtime_authorized() then
    raise insufficient_privilege using message = 'atlas_orchestrator_runtime_unauthorized';
  end if;

  insert into public.atlas_orchestrator_events (
    id, tenant_id, organization_id, task_id,
    event_type, event_json, occurred_at
  ) values (
    p_id, p_tenant_id, p_organization_id, p_task_id,
    p_event_type, p_event_json, p_occurred_at
  );
end;
$$;

create or replace function private.atlas_orchestrator_list_events_internal(
  p_tenant_id text,
  p_organization_id text,
  p_task_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.atlas_orchestrator_runtime_authorized() then
    raise insufficient_privilege using message = 'atlas_orchestrator_runtime_unauthorized';
  end if;

  select coalesce(jsonb_agg(event_json order by occurred_at asc, id asc), '[]'::jsonb)
  into result
  from public.atlas_orchestrator_events
  where tenant_id = p_tenant_id
    and organization_id = p_organization_id
    and task_id = p_task_id;

  return result;
end;
$$;

revoke all on function private.atlas_orchestrator_create_task_internal(text,text,text,integer,text,jsonb,timestamptz,timestamptz) from public, authenticated;
revoke all on function private.atlas_orchestrator_get_task_internal(text,text,text) from public, authenticated;
revoke all on function private.atlas_orchestrator_save_task_internal(text,text,text,integer,text,jsonb,timestamptz) from public, authenticated;
revoke all on function private.atlas_orchestrator_append_event_internal(text,text,text,text,text,jsonb,timestamptz) from public, authenticated;
revoke all on function private.atlas_orchestrator_list_events_internal(text,text,text) from public, authenticated;

grant usage on schema private to anon, service_role;
grant execute on function private.atlas_orchestrator_create_task_internal(text,text,text,integer,text,jsonb,timestamptz,timestamptz) to anon, service_role;
grant execute on function private.atlas_orchestrator_get_task_internal(text,text,text) to anon, service_role;
grant execute on function private.atlas_orchestrator_save_task_internal(text,text,text,integer,text,jsonb,timestamptz) to anon, service_role;
grant execute on function private.atlas_orchestrator_append_event_internal(text,text,text,text,text,jsonb,timestamptz) to anon, service_role;
grant execute on function private.atlas_orchestrator_list_events_internal(text,text,text) to anon, service_role;

create or replace function public.atlas_orchestrator_create_task(
  p_tenant_id text,
  p_organization_id text,
  p_task_id text,
  p_schema_version integer,
  p_state text,
  p_task_json jsonb,
  p_created_at timestamptz,
  p_updated_at timestamptz
) returns void
language sql
security invoker
set search_path = ''
as $$
  select private.atlas_orchestrator_create_task_internal(
    p_tenant_id, p_organization_id, p_task_id, p_schema_version, p_state,
    p_task_json, p_created_at, p_updated_at
  );
$$;

create or replace function public.atlas_orchestrator_get_task(
  p_tenant_id text,
  p_organization_id text,
  p_task_id text
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.atlas_orchestrator_get_task_internal(
    p_tenant_id, p_organization_id, p_task_id
  );
$$;

create or replace function public.atlas_orchestrator_save_task(
  p_tenant_id text,
  p_organization_id text,
  p_task_id text,
  p_schema_version integer,
  p_state text,
  p_task_json jsonb,
  p_updated_at timestamptz
) returns void
language sql
security invoker
set search_path = ''
as $$
  select private.atlas_orchestrator_save_task_internal(
    p_tenant_id, p_organization_id, p_task_id, p_schema_version,
    p_state, p_task_json, p_updated_at
  );
$$;

create or replace function public.atlas_orchestrator_append_event(
  p_id text,
  p_tenant_id text,
  p_organization_id text,
  p_task_id text,
  p_event_type text,
  p_event_json jsonb,
  p_occurred_at timestamptz
) returns void
language sql
security invoker
set search_path = ''
as $$
  select private.atlas_orchestrator_append_event_internal(
    p_id, p_tenant_id, p_organization_id, p_task_id,
    p_event_type, p_event_json, p_occurred_at
  );
$$;

create or replace function public.atlas_orchestrator_list_events(
  p_tenant_id text,
  p_organization_id text,
  p_task_id text
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.atlas_orchestrator_list_events_internal(
    p_tenant_id, p_organization_id, p_task_id
  );
$$;

revoke all on function public.atlas_orchestrator_create_task(text,text,text,integer,text,jsonb,timestamptz,timestamptz) from public, authenticated;
revoke all on function public.atlas_orchestrator_get_task(text,text,text) from public, authenticated;
revoke all on function public.atlas_orchestrator_save_task(text,text,text,integer,text,jsonb,timestamptz) from public, authenticated;
revoke all on function public.atlas_orchestrator_append_event(text,text,text,text,text,jsonb,timestamptz) from public, authenticated;
revoke all on function public.atlas_orchestrator_list_events(text,text,text) from public, authenticated;

grant execute on function public.atlas_orchestrator_create_task(text,text,text,integer,text,jsonb,timestamptz,timestamptz) to anon, service_role;
grant execute on function public.atlas_orchestrator_get_task(text,text,text) to anon, service_role;
grant execute on function public.atlas_orchestrator_save_task(text,text,text,integer,text,jsonb,timestamptz) to anon, service_role;
grant execute on function public.atlas_orchestrator_append_event(text,text,text,text,text,jsonb,timestamptz) to anon, service_role;
grant execute on function public.atlas_orchestrator_list_events(text,text,text) to anon, service_role;
