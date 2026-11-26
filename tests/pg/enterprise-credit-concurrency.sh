#!/usr/bin/env bash
set -euo pipefail
# Requires ephemeral PostgreSQL17 fixtures and credit schema loaded.
# Operates solely on synthetic tenants and does not contact production.
A='00000000-0000-4000-8000-000000000001'
U='00000000-0000-4000-8000-000000000101'
OWNER='00000000-0000-4000-8000-000000000102'
TASK='00000000-0000-4000-8000-000000000301'

# Re-authorize synthetic actor after revocation test.
psql -X -v ON_ERROR_STOP=1 -q <<SQL
update public.organization_members set status='active'
 where org_id='$A' and user_id='$U';
set role service_role;
select public.atlas_enterprise_credit_set_limit('$A','$U','2026-12',5,true,'$OWNER');
select public.atlas_enterprise_credit_set_limit('$A','$U','2027-01',10,true,'$OWNER');
SQL

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
call_reserve() {
  local window="$1" key="$2" amount="$3" output="$4"
  psql -X -qAt -v ON_ERROR_STOP=1 -c "
    set role service_role;
    select public.atlas_enterprise_credit_reserve(
      '$A','$U','$window','$key','$TASK',$amount);
  " >"$output" 2>"$output.err"
}

# Competing *distinct* keys each request 4 against a 5-credit account.
# Exactly one must succeed; a shared row lock prevents double consumption.
call_reserve '2026-12' 'parallel-distinct-0001' 4 "$tmp/a" & p1=$!
call_reserve '2026-12' 'parallel-distinct-0002' 4 "$tmp/b" & p2=$!
r1=0; r2=0
wait "$p1" || r1=$?
wait "$p2" || r2=$?
if [[ $(( (r1 == 0) + (r2 == 0) )) -ne 1 ]]; then
  echo "P0: exactly one competing reservation must succeed, got $r1/$r2"
  cat "$tmp/a.err" "$tmp/b.err"
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -qAt -c "
do \$\$
declare v_reserved bigint; v_count integer;
begin
 select reserved_credits into v_reserved from public.atlas_enterprise_credit_accounts
 where org_id='$A' and user_id='$U' and window_id='2026-12';
 select count(*) into v_count from public.atlas_enterprise_credit_reservations
 where org_id='$A' and user_id='$U' and window_id='2026-12';
 if v_reserved<>4 or v_count<>1 then raise exception 'overspend race P0'; end if;
end
\$\$;
"

# Identical request keys sent from independent sessions are idempotent.
call_reserve '2027-01' 'parallel-identical-0001' 3 "$tmp/c" & p3=$!
call_reserve '2027-01' 'parallel-identical-0001' 3 "$tmp/d" & p4=$!
wait "$p3"; wait "$p4"
a="$(tr -d '\r\n[:space:]' <"$tmp/c")"
b="$(tr -d '\r\n[:space:]' <"$tmp/d")"
if [[ -z "$a" || "$a" != "$b" ]]; then
  echo "P0: parallel identical keys returned different reservation ids"
  cat "$tmp/c" "$tmp/d" "$tmp/c.err" "$tmp/d.err"
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -qAt -c "
do \$\$
declare v_reserved bigint; v_count integer; v_audit integer;
begin
 select reserved_credits into v_reserved from public.atlas_enterprise_credit_accounts
 where org_id='$A' and user_id='$U' and window_id='2027-01';
 select count(*) into v_count from public.atlas_enterprise_credit_reservations
 where org_id='$A' and user_id='$U' and window_id='2027-01';
 select count(*) into v_audit from public.atlas_enterprise_credit_events
 where org_id='$A' and user_id='$U' and window_id='2027-01' and operation='reserved';
 if v_reserved<>3 or v_count<>1 or v_audit<>1 then
   raise exception 'parallel idempotency audit P0';
 end if;
end
\$\$;
"
echo "PG17 concurrent quota and idempotency: PASS"
