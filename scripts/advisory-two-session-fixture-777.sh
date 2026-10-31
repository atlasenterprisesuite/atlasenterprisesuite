#!/usr/bin/env bash
# Synthetic PostgreSQL lock-order fixture; does NOT validate Advisory RPC/RLS.
# Requires a disposable PostgreSQL server with PGHOST pointing to its Unix socket.
set -euo pipefail
[[ "${PGHOST:-}" == /* && -z "${PGPASSWORD:-}" ]] || exit 78
psql -X -v ON_ERROR_STOP=1 -d postgres <<'SQL'
CREATE TABLE IF NOT EXISTS public.atlas_777_lock_fixture (
  id integer PRIMARY KEY, active boolean NOT NULL
);
TRUNCATE public.atlas_777_lock_fixture;
INSERT INTO public.atlas_777_lock_fixture VALUES (777, true);
SQL
# Session A holds the membership lock for two seconds.
psql -X -v ON_ERROR_STOP=1 -d postgres -c "BEGIN; SELECT active FROM public.atlas_777_lock_fixture WHERE id=777 FOR SHARE; SELECT pg_sleep(2); COMMIT;" > /dev/null &
writer=$!
trap 'kill "$writer" 2>/dev/null || true; wait "$writer" 2>/dev/null || true' EXIT
sleep 0.5
# Revocation must wait for session A, then commit.
psql -X -v ON_ERROR_STOP=1 -d postgres -c "BEGIN; UPDATE public.atlas_777_lock_fixture SET active=false WHERE id=777; COMMIT;" > /dev/null
wait "$writer"
trap - EXIT
result=$(psql -X -v ON_ERROR_STOP=1 -At -d postgres -c "SELECT active FROM public.atlas_777_lock_fixture WHERE id=777")
[[ "$result" == f ]] || exit 1
echo 'SYNTHETIC TWO-SESSION FIXTURE COMPLETE; Advisory RPC P0 remains open'
