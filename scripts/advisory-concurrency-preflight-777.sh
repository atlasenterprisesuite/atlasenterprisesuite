#!/usr/bin/env bash
# Advisory concurrency preflight: NOT a revocation or RLS proof.
# Run only inside the existing isolated PostgreSQL runner.
set -euo pipefail
[[ -n "${PGHOST:-}" && "${PGHOST:0:1}" == / ]] || { echo 'BLOCKED: private Unix socket required' >&2; exit 78; }
[[ -z "${PGPASSWORD:-}" ]] || { echo 'BLOCKED: no database password allowed' >&2; exit 78; }
command -v psql >/dev/null || { echo 'BLOCKED: psql unavailable' >&2; exit 78; }
command -v pg_isready >/dev/null || exit 78
pg_isready -q || { echo 'BLOCKED: PostgreSQL unavailable' >&2; exit 78; }
psql -X -v ON_ERROR_STOP=1 -Atqc "select current_setting('listen_addresses')" | grep -qx '' || { echo 'BLOCKED: TCP enabled' >&2; exit 78; }
echo 'PREFLIGHT ONLY: actual two-connection Advisory RPC revocation proof remains P0 OPEN.'
