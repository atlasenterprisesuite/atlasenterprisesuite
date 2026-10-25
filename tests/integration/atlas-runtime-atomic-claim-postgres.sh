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
# Completion is owned by one atomic database predicate, not read-then-update.
winner="$(psql_ci -At -c "select runtime_id from public.execution_runtime_jobs where id='20000000-0000-4000-8000-000000000001';")"
lease="$(psql_ci -At -c "select lease_id from public.execution_runtime_jobs where id='20000000-0000-4000-8000-000000000001';")"
complete() {
  local org="$1" tenant="$2" runtime="$3" job="$4" held_lease="$5"
  psql_ci -At -c "set request.jwt.claim.role = 'service_role'; select state from public.atlas_complete_execution_runtime_job('$org','$tenant','$runtime','$job','$held_lease','completed','{}'::jsonb);"
}
# A different tenant/worker cannot finish someone else's claimed work.
cross_finish="$(complete "$org_b" tenant-b "$runtime_b" 20000000-0000-4000-8000-000000000001 "$lease")"
[[ -z "$cross_finish" ]] || { echo "Cross-tenant completion occurred" >&2; exit 1; }
finished="$(complete "$org_a" tenant-a "$winner" 20000000-0000-4000-8000-000000000001 "$lease")"
[[ "$finished" == completed ]] || { echo "Lease holder could not complete job" >&2; exit 1; }
again="$(complete "$org_a" tenant-a "$winner" 20000000-0000-4000-8000-000000000001 "$lease")"
[[ -z "$again" ]] || { echo "Terminal job completed twice" >&2; exit 1; }
# Claimed work whose lease expired must not commit a late result.
psql_ci -c "insert into public.execution_runtime_jobs(id,org_id,tenant_id,runtime_kind,state) values ('20000000-0000-4000-8000-000000000004','$org_a','tenant-a','cloud_ephemeral','queued');"
late_job="$(claim "$org_a" tenant-a "$runtime_a" cloud_ephemeral)"
[[ "$late_job" == 20000000-0000-4000-8000-000000000004 ]] || { echo "Expired scenario setup failed" >&2; exit 1; }
late_lease="$(psql_ci -At -c "select lease_id from public.execution_runtime_jobs where id='$late_job';")"
psql_ci -c "update public.execution_runtime_jobs set lease_expires_at=now()-interval '1 minute' where id='$late_job';"
late="$(complete "$org_a" tenant-a "$runtime_a" "$late_job" "$late_lease")"
[[ -z "$late" ]] || { echo "Expired lease was accepted" >&2; exit 1; }
late_state="$(psql_ci -At -c "select state from public.execution_runtime_jobs where id='$late_job';")"
[[ "$late_state" == claimed ]] || { echo "Expired work was improperly mutated" >&2; exit 1; }
# Quarantine expired work instead of blindly replaying an external side effect.
quarantine="$(psql_ci -At -c "set request.jwt.claim.role = 'service_role'; select public.atlas_quarantine_expired_runtime_jobs(50);")"
[[ "$quarantine" == 1 ]] || { echo "Expected exactly one expired job to quarantine: $quarantine" >&2; exit 1; }
quarantine_state="$(psql_ci -At -c "select state || ',' || (lease_id is null)::text from public.execution_runtime_jobs where id='$late_job';")"
[[ "$quarantine_state" == "waiting_human,true" ]] || { echo "Quarantine did not fence stale lease: $quarantine_state" >&2; exit 1; }
second_pass="$(psql_ci -At -c "set request.jwt.claim.role = 'service_role'; select public.atlas_quarantine_expired_runtime_jobs(50);")"
[[ "$second_pass" == 0 ]] || { echo "Quarantine must be idempotent: $second_pass" >&2; exit 1; }
reclaimed="$(claim "$org_a" tenant-a "$runtime_a" cloud_ephemeral)"
[[ -z "$reclaimed" ]] || { echo "Quarantined external job was replayed" >&2; exit 1; }
# Service-only functions must reject a non-service caller even when a privileged
# database session could otherwise invoke the function.
denied="$(psql_ci -At -c "set request.jwt.claim.role = 'authenticated'; select count(*) from public.atlas_claim_execution_runtime_job('$org_a','tenant-a','$runtime_a','cloud_ephemeral');" 2>&1)" && {
  echo "Authenticated role unexpectedly invoked claim RPC" >&2; exit 1;
} || true
[[ "$denied" == *service_role_required* ]] || { echo "Unexpected claim rejection: $denied" >&2; exit 1; }
# The already quarantined job must remain quarantined on repeated sweeps.
third_pass="$(psql_ci -At -c "set request.jwt.claim.role = 'service_role'; select public.atlas_quarantine_expired_runtime_jobs(50);")"
[[ "$third_pass" == 0 ]] || { echo "Unexpected repeated quarantine: $third_pass" >&2; exit 1; }
# Simulate a provider that committed an external effect before its worker crashed.
# A durable counter is deliberately outside execution_runtime_jobs: a lease alone
# cannot tell whether the provider has already applied the operation.
psql_ci <<'SQL'
create table public.atlas_ci_external_effects (
  operation_key text primary key,
  apply_count integer not null check (apply_count >= 1)
);
insert into public.atlas_ci_external_effects(operation_key, apply_count)
values ('interrupted-operation', 1);
SQL
psql_ci -c "insert into public.execution_runtime_jobs(id,org_id,tenant_id,runtime_kind,state,lease_id,lease_expires_at)
values ('20000000-0000-4000-8000-000000000005','$org_a','tenant-a','cloud_ephemeral','running',
'30000000-0000-4000-8000-000000000005',now()-interval '1 minute');"
before_effects="$(psql_ci -At -c "select apply_count from public.atlas_ci_external_effects where operation_key='interrupted-operation';")"
[[ "$before_effects" == 1 ]] || { echo "Interrupted provider fixture invalid" >&2; exit 1; }
interrupted_sweep="$(psql_ci -At -c "set request.jwt.claim.role = 'service_role'; select public.atlas_quarantine_expired_runtime_jobs(50);")"
[[ "$interrupted_sweep" == 1 ]] || { echo "Interrupted work not quarantined: $interrupted_sweep" >&2; exit 1; }
interrupted_reclaim="$(claim "$org_a" tenant-a "$runtime_a" cloud_ephemeral)"
[[ -z "$interrupted_reclaim" ]] || { echo "Interrupted external operation re-claimed" >&2; exit 1; }
interrupted_state="$(psql_ci -At -c "select state from public.execution_runtime_jobs where id='20000000-0000-4000-8000-000000000005';")"
[[ "$interrupted_state" == waiting_human ]] || { echo "Interrupted operation escaped quarantine" >&2; exit 1; }
after_effects="$(psql_ci -At -c "select apply_count from public.atlas_ci_external_effects where operation_key='interrupted-operation';")"
[[ "$after_effects" == "$before_effects" ]] || { echo "External effect counter changed after reconciliation" >&2; exit 1; }
# Two independent reconcilers must not count the same expired job twice.
psql_ci -c "insert into public.execution_runtime_jobs(id,org_id,tenant_id,runtime_kind,state,lease_id,lease_expires_at)
values ('20000000-0000-4000-8000-000000000006','$org_a','tenant-a','cloud_ephemeral','running',
'30000000-0000-4000-8000-000000000006',now()-interval '1 minute');"
psql_ci -At -c "set request.jwt.claim.role = 'service_role'; select public.atlas_quarantine_expired_runtime_jobs(50);" >"$results_dir/reconcile-a" &
reconcile_pid_a=$!
psql_ci -At -c "set request.jwt.claim.role = 'service_role'; select public.atlas_quarantine_expired_runtime_jobs(50);" >"$results_dir/reconcile-b" &
reconcile_pid_b=$!
wait "$reconcile_pid_a"
wait "$reconcile_pid_b"
reconciled_total="$(awk '{sum += $1} END {print sum+0}' "$results_dir/reconcile-a" "$results_dir/reconcile-b")"
[[ "$reconciled_total" == 1 ]] || { echo "Concurrent reconcilers double-counted or missed an expired job: $reconciled_total" >&2; exit 1; }
reconciled_state="$(psql_ci -At -c "select state from public.execution_runtime_jobs where id='20000000-0000-4000-8000-000000000006';")"
[[ "$reconciled_state" == waiting_human ]] || { echo "Concurrent reconciliation failed closed: $reconciled_state" >&2; exit 1; }
# Durable reservation ledger: unique keys, cross-tenant denial and concurrent inserts.
psql_ci -f supabase/migrations/20261025_atlas_external_effect_ledger_777.sql
psql_ci -c "insert into public.execution_runtime_jobs(id,org_id,tenant_id,runtime_kind,state,lease_id,lease_expires_at)
values ('20000000-0000-4000-8000-000000000007','$org_a','tenant-a','cloud_ephemeral','running',
'30000000-0000-4000-8000-000000000007',now()+interval '5 minutes');"
reserve_effect() {
  psql_ci -At -c "set request.jwt.claim.role = 'service_role'; select effect_key from public.atlas_reserve_external_effect_777('$org_a','tenant-a','20000000-0000-4000-8000-000000000007','effect-once','mock-provider','provider-key-once');"
}
reserve_effect >"$results_dir/reserve-a" &
reserve_pid_a=$!
reserve_effect >"$results_dir/reserve-b" &
reserve_pid_b=$!
wait "$reserve_pid_a"
wait "$reserve_pid_b"
reservation_count="$(psql_ci -At -c "select count(*) from public.atlas_external_effect_ledger_777 where effect_key='effect-once';")"
[[ "$reservation_count" == 1 ]] || { echo "Duplicate durable effect reservation: $reservation_count" >&2; exit 1; }
cross_effect="$(psql_ci -At -c "set request.jwt.claim.role = 'service_role'; select effect_key from public.atlas_reserve_external_effect_777('$org_b','tenant-b','20000000-0000-4000-8000-000000000007','cross-tenant','mock-provider','cross-provider-key');")"
[[ -z "$cross_effect" ]] || { echo "Cross-tenant external-effect reservation accepted" >&2; exit 1; }
ledger_count="$(psql_ci -At -c "select count(*) from public.atlas_external_effect_ledger_777;")"
[[ "$ledger_count" == 1 ]] || { echo "Unexpected ledger rows: $ledger_count" >&2; exit 1; }
# Verify effective ledger privileges and fail-closed reservation of expired jobs.
ledger_grants="$(psql_ci -At -c "select has_table_privilege('anon','public.atlas_external_effect_ledger_777','SELECT')::text || ',' || has_table_privilege('authenticated','public.atlas_external_effect_ledger_777','INSERT')::text || ',' || has_table_privilege('service_role','public.atlas_external_effect_ledger_777','INSERT')::text;")"
[[ "$ledger_grants" == "false,false,true" ]] || { echo "Unexpected ledger grants: $ledger_grants" >&2; exit 1; }
psql_ci -c "insert into public.execution_runtime_jobs(id,org_id,tenant_id,runtime_kind,state,lease_id,lease_expires_at)
values ('20000000-0000-4000-8000-000000000008','$org_a','tenant-a','cloud_ephemeral','running',
'30000000-0000-4000-8000-000000000008',now()-interval '1 minute');"
expired_reservation="$(psql_ci -At -c "set request.jwt.claim.role = 'service_role'; select effect_key from public.atlas_reserve_external_effect_777('$org_a','tenant-a','20000000-0000-4000-8000-000000000008','expired-effect','mock-provider','expired-provider-key');")"
[[ -z "$expired_reservation" ]] || { echo "Expired job reserved an external effect" >&2; exit 1; }
# The same logical effect must not be reserved with a different provider key.
alternate_effect="$(psql_ci -At -c "set request.jwt.claim.role = 'service_role'; select effect_key from public.atlas_reserve_external_effect_777('$org_a','tenant-a','20000000-0000-4000-8000-000000000007','effect-once','mock-provider','provider-key-alternate');")"
[[ -z "$alternate_effect" ]] || { echo "Logical effect duplicated with alternate provider key" >&2; exit 1; }
# A provider key must not be reused for another logical effect.
reused_provider_key="$(psql_ci -At -c "set request.jwt.claim.role = 'service_role'; select effect_key from public.atlas_reserve_external_effect_777('$org_a','tenant-a','20000000-0000-4000-8000-000000000007','different-effect','mock-provider','provider-key-once');")"
[[ -z "$reused_provider_key" ]] || { echo "Provider idempotency key reused" >&2; exit 1; }
# A queued job without a live lease cannot reserve a provider effect.
psql_ci -c "insert into public.execution_runtime_jobs(id,org_id,tenant_id,runtime_kind,state)
values ('20000000-0000-4000-8000-000000000009','$org_a','tenant-a','cloud_ephemeral','queued');"
unclaimed_effect="$(psql_ci -At -c "set request.jwt.claim.role = 'service_role'; select effect_key from public.atlas_reserve_external_effect_777('$org_a','tenant-a','20000000-0000-4000-8000-000000000009','unclaimed-effect','mock-provider','unclaimed-provider-key');")"
[[ -z "$unclaimed_effect" ]] || { echo "Unclaimed job reserved an external effect" >&2; exit 1; }
final_effect_count="$(psql_ci -At -c "select count(*) from public.atlas_external_effect_ledger_777;")"
[[ "$final_effect_count" == 1 ]] || { echo "Unexpected ledger count after denied reservations: $final_effect_count" >&2; exit 1; }
# Reconciliation is CAS-fenced and auditable, without outbound effects.
psql_ci -f supabase/migrations/20261025_atlas_external_effect_reconciliation_777.sql
wrong_tenant="$(psql_ci -At -c "set request.jwt.claim.role='service_role'; select public.atlas_reconcile_external_effect_777('$org_b','tenant-b','effect-once','reserved','confirmed','foreign-evidence','foreign-receipt');")"
[[ "$wrong_tenant" == f ]] || { echo "Cross-tenant reconciliation accepted" >&2; exit 1; }
reconcile_once() {
 psql_ci -At -c "set request.jwt.claim.role='service_role'; select public.atlas_reconcile_external_effect_777('$org_a','tenant-a','effect-once','reserved','unknown','provider-timeout',null);"
}
reconcile_once >"$results_dir/reconcile-effect-a" &
effect_pid_a=$!
reconcile_once >"$results_dir/reconcile-effect-b" &
effect_pid_b=$!
wait "$effect_pid_a"
wait "$effect_pid_b"
reconcile_winners="$(grep -h -c '^t

 "$results_dir/reconcile-effect-a" "$results_dir/reconcile-effect-b" | awk '{sum += $1} END {print sum+0}')"
[[ "$reconcile_winners" == 1 ]] || { echo "Reconciliation CAS violated: $reconcile_winners" >&2; exit 1; }
forbidden="$(psql_ci -At -c "set request.jwt.claim.role='service_role'; select public.atlas_reconcile_external_effect_777('$org_a','tenant-a','effect-once','unknown','reserved','rollback-evidence',null);")"
[[ "$forbidden" == f ]] || { echo "Forbidden rollback transition accepted" >&2; exit 1; }
confirmed="$(psql_ci -At -c "set request.jwt.claim.role='service_role'; select public.atlas_reconcile_external_effect_777('$org_a','tenant-a','effect-once','unknown','confirmed','provider-confirmation','receipt-once');")"
[[ "$confirmed" == t ]] || { echo "Provider confirmation not reconciled" >&2; exit 1; }
duplicate_receipt="$(psql_ci -At -c "set request.jwt.claim.role='service_role'; select public.atlas_reconcile_external_effect_777('$org_a','tenant-a','effect-once','unknown','confirmed','duplicate','receipt-once');")"
[[ "$duplicate_receipt" == f ]] || { echo "Duplicate receipt created another transition" >&2; exit 1; }
audit_rows="$(psql_ci -At -c "select count(*) from public.atlas_external_effect_audit_777 where evidence_ref in ('provider-timeout','provider-confirmation');")"
[[ "$audit_rows" == 2 ]] || { echo "Reconciliation audit count invalid: $audit_rows" >&2; exit 1; }
# Append-only audit: privileged UPDATE/DELETE must fail at trigger level.
audit_update_error="$(psql_ci -At -c "update public.atlas_external_effect_audit_777 set evidence_ref='tampered' where evidence_ref='provider-confirmation';" 2>&1 || true)"
[[ "$audit_update_error" == *external_effect_audit_append_only* ]] || { echo "Audit UPDATE not rejected" >&2; exit 1; }
audit_delete_error="$(psql_ci -At -c "delete from public.atlas_external_effect_audit_777 where evidence_ref='provider-confirmation';" 2>&1 || true)"
[[ "$audit_delete_error" == *external_effect_audit_append_only* ]] || { echo "Audit DELETE not rejected" >&2; exit 1; }
# An already-confirmed provider receipt cannot be attached to a different effect.
second_effect="$(psql_ci -At -c "set request.jwt.claim.role='service_role'; select effect_key from public.atlas_reserve_external_effect_777('$org_a','tenant-a','20000000-0000-4000-8000-000000000007','effect-two','mock-provider','provider-key-two');")"
[[ "$second_effect" == effect-two ]] || { echo "Second fixture reservation failed" >&2; exit 1; }
receipt_reuse_error="$(psql_ci -At -c "set request.jwt.claim.role='service_role'; select public.atlas_reconcile_external_effect_777('$org_a','tenant-a','effect-two','reserved','confirmed','receipt-conflict','receipt-once');" 2>&1 || true)"
[[ "$receipt_reuse_error" == *duplicate\ key\ value* ]] || { echo "Provider receipt reuse not blocked" >&2; exit 1; }
second_status="$(psql_ci -At -c "select status from public.atlas_external_effect_ledger_777 where effect_key='effect-two';")"
[[ "$second_status" == reserved ]] || { echo "Receipt conflict did not roll back ledger" >&2; exit 1; }
echo "PASS: atomic claim + completion, expiry, cross-tenant denial and fail-closed stale-lease quarantine."

