-- ATLAS 777 BME688 — CANDIDATE DDL ONLY. NOT an applied migration.
-- MUST be migrated using the approved Supabase CLI workflow on isolated PostgreSQL 17
-- and validated with concurrency, cross-tenant, revocation and rollback tests.
-- The function reuses Urban Twin bindings/observations and Local Agent sessions.
-- EXECUTE is restricted to service_role; Edge derives session+agent IDs from
-- validated x-atlas-agent-token and must not accept org/provenance from the sender.

create or replace function public.atlas_ingest_bme688(
  p_session_id uuid, p_agent_id uuid, p_device_id uuid, p_binding_id uuid,
  p_sequence bigint, p_observed_at timestamptz,
  p_temperature_c double precision, p_humidity_percent double precision,
  p_pressure_hpa double precision, p_gas_resistance_ohm double precision
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_org_id uuid;
  v_entity_id uuid;
  v_meta jsonb;
  v_cursor jsonb;
  v_previous bigint;
begin
  -- Do not insert on missing/invalid numeric inputs, bad clock, or spoofed sequence.
  if p_session_id is null or p_agent_id is null or p_device_id is null
     or p_binding_id is null or p_sequence is null
     or p_sequence < 0 or p_sequence > 9007199254740991
     or p_observed_at is null
     or p_observed_at < now() - interval '5 minutes'
     or p_observed_at > now() + interval '30 seconds'
     or p_temperature_c is null or p_temperature_c not between -40 and 85
     or p_humidity_percent is null or p_humidity_percent not between 0 and 100
     or p_pressure_hpa is null or p_pressure_hpa not between 300 and 1100
     or p_gas_resistance_ohm is null
     or p_gas_resistance_ohm <= 0
     or p_gas_resistance_ohm >= 'Infinity'::double precision
  then
    raise exception 'bme688_invalid_frame' using errcode = 'P0001';
  end if;

  -- Session and agent are locked against concurrent revocation.
  select s.org_id into v_org_id
    from public.atlas_local_agent_sessions s
    join public.atlas_local_agents a on a.id = s.agent_id and a.org_id = s.org_id
   where s.id = p_session_id
     and s.agent_id = p_agent_id
     and s.revoked_at is null and s.expires_at > now()
     and a.status = 'online'
   for share of s, a;
  if v_org_id is null then
    raise exception 'bme688_session_invalid' using errcode = 'P0001';
  end if;

  perform 1 from public.atlas_local_devices d
   where d.id = p_device_id and d.agent_id = p_agent_id
     and d.org_id = v_org_id and d.adapter = 'bme688'
     and d.device_type = 'sensor' and d.health_status = 'healthy'
   for share;
  if not found then
    raise exception 'bme688_device_untrusted' using errcode = 'P0001';
  end if;

  -- Lock the canonical binding (also the anti-replay cursor) until COMMIT.
  select b.entity_id, b.metadata into v_entity_id, v_meta
    from public.atlas_urban_twin_bindings b
    join public.atlas_urban_twin_entities e
      on e.id = b.entity_id and e.org_id = b.org_id
   where b.id = p_binding_id
     and b.org_id = v_org_id and b.tenant_id = v_org_id
     and b.binding_type = 'sensor' and b.adapter = 'bme688'
     and b.external_ref = p_device_id::text
     and b.verification_state = 'verified'
     and jsonb_array_length(b.evidence_refs) > 0
     and e.verification_state = 'verified' and e.lifecycle_state = 'active'
   for update of b;
  if v_entity_id is null then
    raise exception 'bme688_binding_unverified' using errcode = 'P0001';
  end if;

  v_cursor := v_meta -> 'atlas_bme688_ingest';
  if v_cursor is not null then
    if jsonb_typeof(v_cursor) <> 'object'
       or (not (v_cursor ? 'last_sequence'))
       or coalesce(v_cursor ->> 'last_sequence', '') !~ '^[0-9]{1,16}$'
    then
      raise exception 'bme688_cursor_invalid' using errcode = 'P0001';
    end if;
    v_previous := (v_cursor ->> 'last_sequence')::bigint;
    if p_sequence <= v_previous then
      raise exception 'bme688_replay' using errcode = 'P0001';
    end if;
  end if;

  update public.atlas_urban_twin_bindings
     set metadata = jsonb_set(
       coalesce(v_meta, '{}'::jsonb),
       '{atlas_bme688_ingest}',
       jsonb_build_object('last_sequence', p_sequence, 'last_observed_at', p_observed_at),
       true
     )
   where id = p_binding_id and org_id = v_org_id;

  -- Exactly four, unchanged direct measurements. Never invent IAQ, CO2 or odor.
  insert into public.atlas_urban_twin_observations (
    tenant_id, org_id, entity_id, binding_id,
    observation_type, provenance, metric_key, value, observed_at, evidence_refs
  )
  select v_org_id, v_org_id, v_entity_id, p_binding_id,
         'telemetry', 'authenticated', m.metric_key,
         jsonb_build_object('reading', m.reading, 'unit', m.unit,
                            'sensor_model', 'BME688', 'sequence', p_sequence),
         p_observed_at,
         jsonb_build_array(jsonb_build_object('kind', 'agent-session',
                                            'session_id', p_session_id,
                                            'device_id', p_device_id))
  from (values
    ('bme688.temperature_c', p_temperature_c, 'celsius'),
    ('bme688.humidity_percent', p_humidity_percent, 'percent'),
    ('bme688.pressure_hpa', p_pressure_hpa, 'hpa'),
    ('bme688.gas_resistance_ohm', p_gas_resistance_ohm, 'ohm')
  ) as m(metric_key, reading, unit);

  -- Durable safe metadata audit; any failure rolls back both cursor and readings.
  insert into public.atlas_local_device_events (
    org_id, agent_id, device_id, event_type, severity, success, safe_detail
  ) values (
    v_org_id, p_agent_id, p_device_id, 'sensor.bme688.ingested', 'info', true,
    jsonb_build_object('metric_count', 4, 'sequence', p_sequence,
                       'binding_id', p_binding_id)
  );
  return 4;
end;
$function$;

revoke all on function public.atlas_ingest_bme688(
  uuid, uuid, uuid, uuid, bigint, timestamptz,
  double precision, double precision, double precision, double precision
) from public, anon, authenticated;

grant execute on function public.atlas_ingest_bme688(
  uuid, uuid, uuid, uuid, bigint, timestamptz,
  double precision, double precision, double precision, double precision
) to service_role;

comment on function public.atlas_ingest_bme688(
  uuid, uuid, uuid, uuid, bigint, timestamptz,
  double precision, double precision, double precision, double precision
) is 'ATLAS 777: service-only, atomic anti-replay BME688 telemetry ingest. Session and org are validated against Local Agent and Urban Twin.';
