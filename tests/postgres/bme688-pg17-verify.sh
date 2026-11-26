#!/usr/bin/env bash
# ATLAS BME688 synthetic PostgreSQL 17 CI drill; no production DB or secrets.
set -euo pipefail
if ! printenv POSTGRES_CONTAINER_ID >/dev/null; then
  echo 'P0: isolated PostgreSQL service container missing' >&2; exit 1
fi
db() { docker exec -i "$POSTGRES_CONTAINER_ID" psql -X -q -t -A -v ON_ERROR_STOP=1 -U postgres -d atlas_ci "$@"; }
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
db < tests/postgres/bme688-pg17-fixture.sql
db < docs/ops/sql/atlas_bme688_atomic_ingest_candidate.sql
db < tests/postgres/bme688-pg17-checks.sql
echo 'PG17: baseline, role grants, tenant isolation, revoked session/entity, replay passed.'

# Concurrent requests with identical counter: first commits, second must fail.
(
db >"$out/first.log" 2>&1 <<'SQL'
set role service_role;
begin;
select public.atlas_ingest_bme688(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
 2,now(),22,50,1013,9500);
select pg_sleep(3);
commit;
SQL
) &
first=$!
ready=0
for attempt in $(seq 1 70); do
  active="$(printf "%s\n" "select count(*) from pg_stat_activity where state='active' and query like 'select pg_sleep(3)%';" | db)"
  if [[ "$active" == "1" ]]; then ready=1; break; fi
  sleep 0.1
done
if [[ "$ready" != "1" ]]; then
  wait "$first" || true
  cat "$out/first.log" >&2
  echo 'P0: first writer did not enter post-lock pause' >&2; exit 1
fi
if db >"$out/second.log" 2>&1 <<'SQL'
set role service_role;
select public.atlas_ingest_bme688(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
 2,now(),22,50,1013,9500);
SQL
then
  echo 'P0: concurrent identical counter was accepted' >&2; exit 1
fi
grep -q 'bme688_replay' "$out/second.log" || { cat "$out/second.log" >&2; exit 1; }
wait "$first"
echo 'PG17: concurrent replay rejected under row lock.'

db <<'SQL'
do $$
begin
 if (select count(*) from public.atlas_urban_twin_observations) <> 8
   or (select count(*) from public.atlas_local_device_events) <> 2 then
    raise exception 'P0: partial concurrent transaction';
 end if;
end $$;
create function public.bme688_ci_deny_audit() returns trigger
language plpgsql as $$
begin raise exception 'bme688_ci_forced_audit_failure'; end $$;
create trigger bme688_ci_deny_audit before insert on public.atlas_local_device_events
for each row execute function public.bme688_ci_deny_audit();
SQL

# Forced audit failure must undo four inserted metrics AND binding cursor.
if db >"$out/audit.log" 2>&1 <<'SQL'
set role service_role;
select public.atlas_ingest_bme688(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
 3,now(),22,50,1013,9500);
SQL
then echo 'P0: audit failure did not roll back' >&2; exit 1; fi
grep -q 'bme688_ci_forced_audit_failure' "$out/audit.log"

db <<'SQL'
do $$
begin
 if (select count(*) from public.atlas_urban_twin_observations) <> 8 then
   raise exception 'P0: orphan readings after rollback';
 end if;
 if (select metadata->'atlas_bme688_ingest'->>'last_sequence'
       from public.atlas_urban_twin_bindings
       where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1') <> '2' then
   raise exception 'P0: rollback advanced cursor';
 end if;
end $$;
drop trigger bme688_ci_deny_audit on public.atlas_local_device_events;
drop function public.bme688_ci_deny_audit();
SQL

db <<'SQL'
set role service_role;
select public.atlas_ingest_bme688(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
 3,now(),22,50,1013,9500);
reset role;
do $$
begin
 if (select count(*) from public.atlas_urban_twin_observations) <> 12
   or (select count(*) from public.atlas_local_device_events) <> 3 then
   raise exception 'P0: failed recovery after rollback';
 end if;
 if (select metadata->'atlas_bme688_ingest'->>'last_sequence'
       from public.atlas_urban_twin_bindings
       where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1') <> '3' then
   raise exception 'P0: retry cursor mismatch';
 end if;
end $$;
SQL
echo 'PG17: forced audit rollback and successful retry passed.'
