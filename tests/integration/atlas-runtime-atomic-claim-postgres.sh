#!/usr/bin/env bash
# ATLAS 777: isolated PostgreSQL integration checks. Never point this at production.
set -euo pipefail
: "${PGHOST:?PGHOST must point to an isolated CI PostgreSQL instance}"
: "${PGDATABASE:?PGDATABASE must be an isolated CI database}"
if [[ "${PGDATABASE}" != "atlas_runtime_ci" ]]; then
  echo "FAIL CLOSED: requires isolated database atlas_runtime_ci" >&2
  exit 2
fi
psql_ci() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }
psql_ci <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create function auth.role() returns text language sql stable
as $$ select current_setting('request.jwt.claim.role', true)::text $$;
create table public.execution_runtime_registrations (
  id uuid primary key, org_id uuid not null, tenant_id text not null,
  kind text not null, status text not null, last_seen_at timestamptz
);
create table public.execution_runtime_jobs (
  id uuid primary key, org_id uuid not null, tenant_id text not null,
  workflow_id uuid, task_id uuid, step_id uuid, runtime_id uuid,
  runtime_kind text not null, state text not null,
  execution_envelope jsonb not null default '{}'::jsonb,
  action jsonb not null default '{}'::jsonb, sanitized_result jsonb,
  lease_id uuid, lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.execution_runtime_registrations
  (id,org_id,tenant_id,kind,status,last_seen_at) values
  ('10000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','cloud_ephemeral','online',now()),
  ('10000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','cloud_ephemeral','online',now()),
  ('10000000-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','tenant-b','cloud_ephemeral','online',now()),
  ('10000000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','self_hosted','offline',now());
insert into public.execution_runtime_jobs
  (id,org_id,tenant_id,runtime_kind,state) values
  ('20000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','cloud_ephemeral','queued'),
  ('20000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','tenant-b','cloud_ephemeral','queued'),
  ('20000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','self_hosted','queued');
SQL
psql_ci -f supabase/migrations/20261025_atlas_atomic_runtime_claim_777.sql
permissions="$(psql_ci -At -c "select has_function_privilege('anon','public.atlas_claim_execution_runtime_job(uuid,text,uuid,text)','EXECUTE')::text || ',' || has_function_privilege('authenticated','public.atlas_claim_execution_runtime_job(uuid,text,uuid,text)','EXECUTE')::text || ',' || has_function_privilege('service_role','public.atlas_claim_execution_runtime_job(uuid,text,uuid,text)','EXECUTE')::text;")"
[[ "$permissions" == "false,false,true" ]] || { echo "Unexpected EXECUTE grants: $permissions" >&2; exit 1; }
org_a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
org_b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
runtime_a="10000000-0000-4000-8000-000000000001"
runtime_a2="10000000-0000-4000-8000-000000000002"
runtime_b="10000000-0000-4000-8000-000000000003"
runtime_offline="10000000-0000-4000-8000-000000000004"
claim() {
  local org="$1" tenant="$2" runtime="$3" kind="$4"
  psql_ci -At -c "set request.jwt.claim.role = 'service_role'; select id from public.atlas_claim_execution_runtime_job('$org','$tenant','$runtime','$kind');"
}
results_dir="$(mktemp -d)"
trap 'rm -rf "$results_dir"' EXIT
claim "$org_a" tenant-a "$runtime_a" cloud_ephemeral >"$results_dir/a" &
pid_a=$!
claim "$org_a" tenant-a "$runtime_a2" cloud_ephemeral >"$results_dir/b" &
pid_b=$!
wait "$pid_a"
wait "$pid_b"
claims="$(cat "$results_dir/a" "$results_dir/b" | grep -c '^20000000-0000-4000-8000-000000000001$' || true)"
[[ "$claims" -eq 1 ]] || { echo "Concurrent claim must return exactly one job; got $claims" >&2; exit 1; }
state="$(psql_ci -At -c "select state || ',' || (lease_id is not null)::text || ',' || (lease_expires_at > now())::text from public.execution_runtime_jobs where id='20000000-0000-4000-8000-000000000001';")"
[[ "$state" == "claimed,true,true" ]] || { echo "Invalid lease state: $state" >&2; exit 1; }
cross="$(claim "$org_b" tenant-b "$runtime_a" cloud_ephemeral)"
[[ -z "$cross" ]] || { echo "Cross-tenant claim occurred" >&2; exit 1; }
offline="$(claim "$org_a" tenant-a "$runtime_offline" self_hosted)"
[[ -z "$offline" ]] || { echo "Offline runtime claimed a job" >&2; exit 1; }
own_b="$(claim "$org_b" tenant-b "$runtime_b" cloud_ephemeral)"
[[ "$own_b" == "20000000-0000-4000-8000-000000000002" ]] || { echo "Tenant B could not claim its own job" >&2; exit 1; }
replay="$(claim "$org_a" tenant-a "$runtime_a" cloud_ephemeral)"
[[ -z "$replay" ]] || { echo "Already claimed job returned twice" >&2; exit 1; }
echo "PASS: atomic claim, concurrent single owner, tenant isolation, active heartbeat, grants, lease and no replay."
