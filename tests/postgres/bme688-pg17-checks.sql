-- Real PostgreSQL 17 test queries on synthetic fixture data.
-- Run only inside the ephemeral CI container. No production SQL or secrets.
\set ON_ERROR_STOP on

-- Lack of EXECUTE is not enough to claim protection; ensure catalog grants are exact.
do $$
begin
  if has_function_privilege('anon', 'public.atlas_ingest_bme688(uuid,uuid,uuid,uuid,bigint,timestamptz,double precision,double precision,double precision,double precision)', 'execute')
     or has_function_privilege('authenticated', 'public.atlas_ingest_bme688(uuid,uuid,uuid,uuid,bigint,timestamptz,double precision,double precision,double precision,double precision)', 'execute')
  then raise exception 'P0: public EXECUTE leak'; end if;
  if not has_function_privilege('service_role', 'public.atlas_ingest_bme688(uuid,uuid,uuid,uuid,bigint,timestamptz,double precision,double precision,double precision,double precision)', 'execute')
  then raise exception 'P0: service role lacks permitted execution'; end if;
end $$;

set role service_role;
do $$
declare v_count integer;
begin
  select public.atlas_ingest_bme688(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    1, now(), 22.1, 50.5, 1013.2, 9500.0
  ) into v_count;
  if v_count <> 4 then raise exception 'P0: expected four direct readings, got %', v_count; end if;

  select count(*) into v_count from public.atlas_urban_twin_observations
   where org_id='11111111-1111-4111-8111-111111111111' and provenance='authenticated';
  if v_count <> 4 then raise exception 'P0: expected exactly 4 persisted readings'; end if;

  -- Four direct channels only; never invented CO2, odor or IAQ.
  if (select count(distinct metric_key) from public.atlas_urban_twin_observations) <> 4 then
    raise exception 'P0: unexpected metric set';
  end if;
  if (select count(*) from public.atlas_local_device_events where event_type='sensor.bme688.ingested') <> 1 then
    raise exception 'P0: audit missing';
  end if;
end $$;

-- Negative cases must never advance sequence or insert partial observations.
do $$
declare denied boolean;
begin
  denied:=false;
  begin
    perform public.atlas_ingest_bme688(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
      1, now(), 22, 50, 1013, 9500
    );
  exception when sqlstate 'P0001' then denied:=true;
  end;
  if not denied then raise exception 'P0: replay accepted'; end if;

  denied:=false;
  begin
    perform public.atlas_ingest_bme688(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
      2, now(), 22, 50, 1013, 9500
    );
  exception when sqlstate 'P0001' then denied:=true;
  end;
  if not denied then raise exception 'P0: cross-tenant binding accepted'; end if;

  denied:=false;
  begin
    perform public.atlas_ingest_bme688(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
      2, now(), 22, 50, 1013, 9500
    );
  exception when sqlstate 'P0001' then denied:=true;
  end;
  if not denied then raise exception 'P0: foreign device accepted'; end if;

  denied:=false;
  begin
    perform public.atlas_ingest_bme688(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
      2, now() - interval '7 minutes', 22, 50, 1013, 9500
    );
  exception when sqlstate 'P0001' then denied:=true;
  end;
  if not denied then raise exception 'P0: stale frame accepted'; end if;
end $$;

reset role;
update public.atlas_local_agent_sessions set revoked_at=now()
 where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
set role service_role;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.atlas_ingest_bme688(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
      2, now(), 22, 50, 1013, 9500
    );
  exception when sqlstate 'P0001' then denied:=true;
  end;
  if not denied then raise exception 'P0: revoked session accepted'; end if;
end $$;
reset role;
update public.atlas_local_agent_sessions set revoked_at=null
 where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
update public.atlas_urban_twin_entities set verification_state='revoked'
 where id='dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
set role service_role;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.atlas_ingest_bme688(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
      2, now(), 22, 50, 1013, 9500
    );
  exception when sqlstate 'P0001' then denied:=true;
  end;
  if not denied then raise exception 'P0: revoked entity accepted'; end if;
end $$;
reset role;
update public.atlas_urban_twin_entities set verification_state='verified'
 where id='dddddddd-dddd-4ddd-8ddd-ddddddddddd1';

do $$
begin
  if (select count(*) from public.atlas_urban_twin_observations) <> 4 then
    raise exception 'P0: rejection inserted unauthorized observations';
  end if;
  if (select metadata->'atlas_bme688_ingest'->>'last_sequence' from public.atlas_urban_twin_bindings
      where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1') <> '1' then
    raise exception 'P0: rejection advanced anti-replay cursor';
  end if;
end $$;
