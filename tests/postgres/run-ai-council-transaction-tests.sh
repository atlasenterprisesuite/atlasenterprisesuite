#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres
psql -v ON_ERROR_STOP=1 -f tests/postgres/ai-council-transaction-fixture.sql
psql -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO fixture.approvals VALUES ('concurrent-1','org-a','user-a',repeat('a',64),'approved',now()+interval '5 minutes');
SQL
run_consume() {
  psql -v ON_ERROR_STOP=1 -Atqc "select fixture.consume_approved_action('concurrent-1','org-a','user-a',repeat('a',64),false)" >/tmp/council-consume-"$1".out 2>/tmp/council-consume-"$1".err
}
set +e
run_consume 1 & p1=$!
run_consume 2 & p2=$!
wait "$p1"; s1=$?
wait "$p2"; s2=$?
set -e
successes=0; [[ $s1 -eq 0 ]] && successes=$((successes+1)); [[ $s2 -eq 0 ]] && successes=$((successes+1))
test "$successes" -eq 1
test "$(psql -Atqc "select count(*) from fixture.consumptions where approval_id='concurrent-1'")" = "1"
test "$(psql -Atqc "select count(*) from fixture.audit_events where approval_id='concurrent-1'")" = "1"
psql -v ON_ERROR_STOP=1 -c "insert into fixture.approvals values ('audit-fail','org-a','user-a',repeat('b',64),'approved',now()+interval '5 minutes')" >/dev/null
set +e
psql -v ON_ERROR_STOP=1 -c "select fixture.consume_approved_action('audit-fail','org-a','user-a',repeat('b',64),true)" >/tmp/council-audit-fail.out 2>&1
audit_status=$?
set -e
test "$audit_status" -ne 0
test "$(psql -Atqc "select count(*) from fixture.consumptions where approval_id='audit-fail'")" = "0"
test "$(psql -Atqc "select count(*) from fixture.audit_events where approval_id='audit-fail'")" = "0"
set +e
psql -v ON_ERROR_STOP=1 -c "select fixture.consume_approved_action('concurrent-1','org-b','user-a',repeat('a',64),false)" >/tmp/council-tenant-deny.out 2>&1
tenant_status=$?
set -e
test "$tenant_status" -ne 0
test "$(psql -Atqc "select exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='fixture.consume_approved_action(text,text,text,text,boolean)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE')")" = "f"
echo "PASS: concurrent single-consume (one winner); audit failure rollback; cross-tenant denial; PUBLIC execute revoked"
