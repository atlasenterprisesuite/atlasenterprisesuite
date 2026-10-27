#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must point to isolated CI PostgreSQL}"
export PGOPTIONS="-c client_min_messages=warning"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE service_role NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE TABLE public.execution_runtime_registrations (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, tenant_id text NOT NULL,
 kind text NOT NULL, status text NOT NULL
);
CREATE TABLE public.execution_runtime_jobs (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, tenant_id text NOT NULL,
 runtime_kind text NOT NULL, state text NOT NULL DEFAULT 'queued',
 runtime_id uuid, lease_id uuid, lease_expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT USAGE ON SCHEMA public TO service_role, authenticated, anon;
GRANT SELECT ON public.execution_runtime_registrations TO service_role;
GRANT SELECT, UPDATE ON public.execution_runtime_jobs TO service_role;
INSERT INTO public.execution_runtime_registrations VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','worker','online'),
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','worker','revoked');
INSERT INTO public.execution_runtime_jobs(id,org_id,tenant_id,runtime_kind,state) VALUES
 ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','worker','queued'),
 ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-b','worker','queued');
SQL
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261025120000_execution_claim_runtime_job_777.sql
claim="SELECT count(*) FROM public.execution_claim_runtime_job_777('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','worker');"
# Two independent connections race for one queued job; exactly one must win.
( psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "SET ROLE service_role; $claim" | tail -1 > /tmp/atlas-claim-a ) &
a=$!
( psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "SET ROLE service_role; $claim" | tail -1 > /tmp/atlas-claim-b ) &
b=$!
wait "$a"; wait "$b"
first=$(cat /tmp/atlas-claim-a); second=$(cat /tmp/atlas-claim-b)
test "$((first + second))" -eq 1
test "$(psql "$DATABASE_URL" -At -c "SELECT count(*) FROM public.execution_runtime_jobs WHERE state='claimed' AND lease_id IS NOT NULL AND lease_expires_at > now();")" = "1"
test "$(psql "$DATABASE_URL" -At -c "SELECT count(*) FROM public.execution_runtime_jobs WHERE tenant_id='tenant-b' AND state='queued';")" = "1"
# A valid runtime cannot claim another tenant or organization.
test "$(psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT count(*) FROM public.execution_claim_runtime_job_777('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','worker');" | tail -1)" = "0"
for rejected in \
 "SET ROLE service_role; SELECT * FROM public.execution_claim_runtime_job_777('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','worker');" \
 "SET ROLE service_role; SELECT * FROM public.execution_claim_runtime_job_777('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-b','worker');" \
 "SET ROLE authenticated; $claim" \
 "SET ROLE anon; $claim"; do
 if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$rejected" >/dev/null 2>&1; then
   echo "FAIL: unauthorized claim succeeded" >&2; exit 1
 fi
done
# Expired leases must be quarantined, never automatically requeued.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
UPDATE public.execution_runtime_jobs
SET state='running', lease_expires_at=clock_timestamp()-interval '1 minute'
WHERE id='33333333-3333-4333-8333-333333333333';
INSERT INTO public.execution_runtime_jobs(id,org_id,tenant_id,runtime_kind,state,runtime_id,lease_id,lease_expires_at)
VALUES
('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','worker','claimed','11111111-1111-4111-8111-111111111111',gen_random_uuid(),clock_timestamp()-interval '1 minute'),
('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-b','worker','running','11111111-1111-4111-8111-111111111111',gen_random_uuid(),clock_timestamp()-interval '1 minute');
SQL
test "$(psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "SET ROLE service_role; $claim" | tail -1)" = "0"
test "$(psql "$DATABASE_URL" -At -c "SELECT count(*) FROM public.execution_runtime_jobs WHERE id IN ('33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555') AND state='waiting_human';")" = "2"
test "$(psql "$DATABASE_URL" -At -c "SELECT count(*) FROM public.execution_runtime_jobs WHERE id='66666666-6666-4666-8666-666666666666' AND state='running';")" = "1"
test "$(psql "$DATABASE_URL" -At -c "SELECT count(*) FROM public.execution_runtime_jobs WHERE tenant_id='tenant-a' AND state='queued';")" = "0"
echo "PASS: expired claimed/running quarantined, no replay, tenant isolation"
echo "PASS: atomic single claim, scoped tenant, lease, revoked runtime, role restrictions"
