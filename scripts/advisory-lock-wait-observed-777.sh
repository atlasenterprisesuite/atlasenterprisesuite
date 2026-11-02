#!/usr/bin/env bash
# Deterministic synthetic PostgreSQL two-session lock test.
# Runs only against an existing disposable, Unix-socket-only PostgreSQL server.
# This does NOT execute real Advisory RPCs, migrations or RLS.
set -euo pipefail
[[ "${PGHOST:-}" == /* && -z "${PGPASSWORD:-}" ]] || { echo 'BLOCKED: private socket required' >&2; exit 78; }
[[ "$(psql -X -v ON_ERROR_STOP=1 -At -d postgres -c 'show listen_addresses')" == '' ]] || exit 78
psql -X -v ON_ERROR_STOP=1 -d postgres <<'SQL'
CREATE TABLE IF NOT EXISTS public.atlas_777_barrier_fixture (id integer primary key, active boolean not null);
TRUNCATE public.atlas_777_barrier_fixture;
INSERT INTO public.atlas_777_barrier_fixture VALUES (777,true);
SQL
work=$(mktemp -d)
trap 'rm -rf "$work"; kill "${holder:-}" 2>/dev/null || true' EXIT
# Session A acquires the lock and waits for an explicit release marker.
(
  psql -X -v ON_ERROR_STOP=1 -d postgres <<'SQL'
BEGIN;
SELECT active FROM public.atlas_777_barrier_fixture WHERE id=777 FOR SHARE;
SELECT pg_sleep(3);
COMMIT;
SQL
  echo committed > "$work/holder.done"
) > "$work/holder.log" 2>&1 &
holder=$!
# Use pg_locks to observe A's row-table lock before launching B.
ready=0
for _ in $(seq 1 60); do
  count=$(psql -X -v ON_ERROR_STOP=1 -At -d postgres -c "SELECT count(*) FROM pg_locks WHERE relation='public.atlas_777_barrier_fixture'::regclass AND mode='RowShareLock' AND granted")
  if [[ "$count" -ge 1 ]]; then ready=1; break; fi
  sleep 0.05
done
[[ "$ready" == 1 ]] || { echo 'BLOCKED: holder lock not observed' >&2; exit 78; }
# Session B must wait for the same membership row to become available.
(
  psql -X -v ON_ERROR_STOP=1 -d postgres -c "BEGIN; UPDATE public.atlas_777_barrier_fixture SET active=false WHERE id=777; COMMIT;"
  echo committed > "$work/revoke.done"
) > "$work/revoke.log" 2>&1 &
revoker=$!
blocked=0
for _ in $(seq 1 40); do
  if [[ -f "$work/revoke.done" ]]; then
    echo 'FAIL: revocation committed before holder finished' >&2; exit 1
  fi
  waiting=$(psql -X -v ON_ERROR_STOP=1 -At -d postgres -c "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%atlas_777_barrier_fixture%' AND pid <> pg_backend_pid()")
  if [[ "$waiting" -ge 1 ]]; then blocked=1; break; fi
  sleep 0.05
done
[[ "$blocked" == 1 ]] || { echo 'FAIL: revocation lock wait not observed' >&2; exit 1; }
wait "$holder"
wait "$revoker"
[[ -f "$work/holder.done" && -f "$work/revoke.done" ]] || exit 1
[[ "$(psql -X -v ON_ERROR_STOP=1 -At -d postgres -c 'select active from public.atlas_777_barrier_fixture where id=777')" == f ]] || exit 1
echo 'SYNTHETIC LOCK WAIT VERIFIED; REAL ADVISORY RPC P0 OPEN'
