#!/usr/bin/env bash
# ATLAS GPS 5D: preflight ONLY. No checkout, downloads, installs, tests or services.
# Intended for a disposable Linux runner with a pre-provisioned offline checkout.
set -Eeuo pipefail
umask 077
fail() { printf 'GPS5D P0 BLOCKED: %s\n' "$*" >&2; exit 1; }
EXPECTED_SHA="${1:-}"
[[ "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]] || fail 'provide an exact 40-hex SHA'
[[ "$(id -u)" != 0 ]] || fail 'do not run as root'
[[ -z "${GITHUB_TOKEN:-}" && -z "${GH_TOKEN:-}" && -z "${SUPABASE_SERVICE_ROLE_KEY:-}" && -z "${DATABASE_URL:-}" && -z "${PGPASSWORD:-}" ]] || fail 'sensitive credential environment variable detected'
for tool in git node npm psql initdb pg_ctl unshare; do
  command -v "$tool" >/dev/null 2>&1 || fail "missing offline tool: $tool"
done
[[ -d .git && -f package-lock.json && -f tests/sql/gps5d-idrive-rls-isolated.fixture.sql ]] || fail 'incomplete local checkout'
[[ "$(git rev-parse --verify HEAD)" == "$EXPECTED_SHA" ]] || fail 'checkout HEAD mismatch'
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || fail 'checkout is not clean'
[[ -x node_modules/.bin/vitest && -x node_modules/.bin/tsc ]] || fail 'preinstalled offline dependencies missing; no npm install permitted'
# A successful network namespace creation does NOT prove egress isolation of
# the entire runner, its dependencies, or child processes. A trusted runner
# must provide independent enforcement and evidence before tests may run.
if ! unshare --user --map-root-user --net --fork -- sh -c 'test -z "$(cat /proc/net/route | tail -n +2)"' >/dev/null 2>&1; then
  fail 'unable to demonstrate a namespace with no IPv4 routes'
fi
fail 'namespace smoke check alone is insufficient; require separately reviewed runner egress controls, ephemeral PostgreSQL data directory, offline dependency provenance and execution approval'
