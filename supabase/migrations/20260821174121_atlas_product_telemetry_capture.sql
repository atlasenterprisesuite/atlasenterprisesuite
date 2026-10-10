create or replace function public.capture_atlas_product_event(
  organization_uuid uuid,
  event_type_value text,
  source_module_value text,
  target_module_value text default null,
  entity_type_value text default null,
  entity_id_value text default null,
  event_status_value text default null,
  duration_ms_value integer default null,
  release_value text default null,
  trace_id_value text default null,
  surface_value text default null
)
returns bigint
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id bigint;
  v_event text := lower(btrim(coalesce(event_type_value, '')));
  v_source text := lower(btrim(coalesce(source_module_value, '')));
  v_target text := nullif(lower(btrim(coalesce(target_module_value, ''))), '');
  v_entity_type text := nullif(lower(btrim(coalesce(entity_type_value, ''))), '');
  v_entity_id text := nullif(btrim(coalesce(entity_id_value, '')), '');
  v_status text := nullif(lower(btrim(coalesce(event_status_value, ''))), '');
  v_release text := nullif(btrim(coalesce(release_value, '')), '');
  v_trace text := nullif(btrim(coalesce(trace_id_value, '')), '');
  v_surface text := nullif(lower(btrim(coalesce(surface_value, ''))), '');
  v_payload jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if not public.is_org_member(organization_uuid) then
    raise exception 'organization_membership_required';
  end if;

  if v_event !~ '^[a-z0-9][a-z0-9._-]{1,79}$' then
    raise exception 'invalid_event_type';
  end if;

  if v_source !~ '^[a-z0-9][a-z0-9._-]{1,79}$' then
    raise exception 'invalid_source_module';
  end if;

  if v_target is not null and v_target !~ '^[a-z0-9][a-z0-9._-]{1,79}$' then
    raise exception 'invalid_target_module';
  end if;

  if v_entity_type is not null and v_entity_type !~ '^[a-z0-9][a-z0-9._-]{0,79}$' then
    raise exception 'invalid_entity_type';
  end if;

  if v_entity_id is not null and length(v_entity_id) > 160 then
    raise exception 'entity_id_too_long';
  end if;

  if v_status is not null and v_status not in ('started','success','error','cancelled','blocked','empty') then
    raise exception 'invalid_event_status';
  end if;

  if duration_ms_value is not null and (duration_ms_value < 0 or duration_ms_value > 86400000) then
    raise exception 'invalid_duration_ms';
  end if;

  if v_release is not null and length(v_release) > 120 then
    raise exception 'release_too_long';
  end if;

  if v_trace is not null and length(v_trace) > 160 then
    raise exception 'trace_id_too_long';
  end if;

  if v_surface is not null and v_surface not in ('web','ios','android','windows','api','agent','worker') then
    raise exception 'invalid_surface';
  end if;

  if v_status is not null then
    v_payload := v_payload || jsonb_build_object('status', v_status);
  end if;
  if duration_ms_value is not null then
    v_payload := v_payload || jsonb_build_object('duration_ms', duration_ms_value);
  end if;
  if v_release is not null then
    v_payload := v_payload || jsonb_build_object('release', v_release);
  end if;
  if v_trace is not null then
    v_payload := v_payload || jsonb_build_object('trace_id', v_trace);
  end if;
  if v_surface is not null then
    v_payload := v_payload || jsonb_build_object('surface', v_surface);
  end if;

  insert into public.atlas_events(
    org_id,
    event_type,
    source_module,
    target_module,
    entity_type,
    entity_id,
    payload,
    actor_id
  ) values (
    organization_uuid,
    v_event,
    v_source,
    v_target,
    v_entity_type,
    v_entity_id,
    v_payload,
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.capture_atlas_product_event(uuid,text,text,text,text,text,text,integer,text,text,text) from public, anon;
grant execute on function public.capture_atlas_product_event(uuid,text,text,text,text,text,text,integer,text,text,text) to authenticated, service_role;

comment on function public.capture_atlas_product_event(uuid,text,text,text,text,text,text,integer,text,text,text)
is 'ATLAS privacy-minimized product telemetry capture. SECURITY INVOKER; tenant RLS remains authoritative. Accepts only normalized operational fields and never arbitrary payload JSON.';
