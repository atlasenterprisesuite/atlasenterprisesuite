#!/usr/bin/env bash
set -euo pipefail

# Only run against a disposable PostgreSQL CI instance. No production project IDs/secrets.
if [[ "$ATLAS_CLIMATE_ISOLATED_TEST_DB" != "true" || "$PGHOST" != "127.0.0.1" || "$PGDATABASE" != "postgres" ]]; then
  echo "Refusing to run outside isolated CI PostgreSQL"
  exit 2
fi

ORGA='10000000-0000-4000-8000-000000000001'
USERA='11000000-0000-4000-8000-000000000001'
ORGB='20000000-0000-4000-8000-000000000002'
USERB='22000000-0000-4000-8000-000000000002'
query() { psql -X -A -t -q -v ON_ERROR_STOP=1 -c "$1"; }
slot() { query "set role service_role; select public.atlas_climate_acquire_read_slot('$1','$2');" | tail -n 1; }
assert_eq() {
  if [[ "$1" != "$2" ]]; then
    echo "FAIL $3 expected=$2 got=$1"
    exit 1
  fi
}

# Avoid minute rollover during the burst to prevent nondeterministic timing.
sec="$(query 'select extract(second from clock_timestamp())::int;')"
if (( sec > 40 )); then sleep "$((61 - sec))"; fi

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
pids=()
for n in $(seq 1 7); do
  (slot "$ORGA" "$USERA" > "$temp_dir/slot-$n") &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
allowed="$(grep -l '^t$' "$temp_dir"/slot-* | wc -l | tr -d ' ')"
denied="$(grep -l '^f$' "$temp_dir"/slot-* | wc -l | tr -d ' ')"
assert_eq "$allowed" "6" "six concurrent requests allowed"
assert_eq "$denied" "1" "seventh concurrent request denied"
count_a="$(query "select request_count from public.atlas_climate_provider_read_quota where org_id='$ORGA';")"
assert_eq "$count_a" "6" "atomic org A quota"
audit_a="$(query "select count(*) from public.audit_logs where org_id='$ORGA' and action='climate.noaa.request.reserved';")"
assert_eq "$audit_a" "6" "one durable audit for each reserved slot"

# A user outside the organization cannot reserve another organization's quota.
if slot "$ORGA" "$USERB" > /dev/null 2>&1; then
  echo "FAIL cross-tenant member acquired provider slot"
  exit 1
fi
assert_eq "$(query "select request_count from public.atlas_climate_provider_read_quota where org_id='$ORGA';")" "6" "no cross-tenant mutation"

# Artificially reject the audit write. Quota insert and audit must roll back together.
query "alter table public.audit_logs add constraint climate_test_reject_audit check (action <> 'climate.noaa.request.reserved') not valid;" > /dev/null
if slot "$ORGB" "$USERB" > /dev/null 2>&1; then
  echo "FAIL quota committed without mandatory audit"
  exit 1
fi
assert_eq "$(query "select count(*) from public.atlas_climate_provider_read_quota where org_id='$ORGB';")" "0" "rolled-back org B reservation"
query "alter table public.audit_logs drop constraint climate_test_reject_audit;" > /dev/null

assert_eq "$(slot "$ORGB" "$USERB")" "t" "other organization unaffected"
assert_eq "$(query "select request_count from public.atlas_climate_provider_read_quota where org_id='$ORGB';")" "1" "independent org B quota"
assert_eq "$(query "select count(*) from public.audit_logs where org_id='$ORGB' and action='climate.noaa.request.reserved';")" "1" "other org audited"

if query "set role authenticated; select public.atlas_climate_acquire_read_slot('$ORGA','$USERA');" > /dev/null 2>&1; then
  echo "FAIL authenticated browser role executed server-only quota RPC"
  exit 1
fi
echo "PASS isolated PostgreSQL: 7-way concurrency, RBAC, cross-tenant denial, audit rollback"
