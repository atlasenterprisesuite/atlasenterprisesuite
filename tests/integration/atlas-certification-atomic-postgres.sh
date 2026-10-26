#!/usr/bin/env bash
# Execute only against a disposable PostgreSQL instance; never production.
set -euo pipefail
[[ "${PGDATABASE:-}" == "atlas_certification_ci" && "${PGHOST:-}" == "localhost" ]] || {
  echo "FAIL CLOSED: expected localhost/atlas_certification_ci" >&2; exit 2;
}
psql_ci() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }
psql_ci <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create function auth.role() returns text language sql stable
as $$ select current_setting('request.jwt.claim.role', true)::text $$;
SQL
psql_ci -f supabase/migrations/20261026_atlas_certification_atomic_777.sql
result="$(psql_ci -At -c "select has_function_privilege('anon','public.atlas_record_certification_777(uuid,text,text,text,jsonb)','EXECUTE')::text || ',' || has_function_privilege('authenticated','public.atlas_record_certification_777(uuid,text,text,text,jsonb)','EXECUTE')::text || ',' || has_function_privilege('service_role','public.atlas_record_certification_777(uuid,text,text,text,jsonb)','EXECUTE')::text;")"
[[ "$result" == "false,false,true" ]] || { echo "FAIL: unexpected grants $result" >&2; exit 1; }
psql_ci <<'SQL'
set request.jwt.claim.role = 'service_role';
do $$
declare
  org_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  org_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  sha text := repeat('a',40);
  payload jsonb := jsonb_build_object('moduleId','atlas-pay','sha',repeat('a',40),'state','validation','certified',false,'blockers',jsonb_build_array('P0_OPEN'),'verifiedChecks',jsonb_build_array('unit'));
begin
  if not public.atlas_record_certification_777(org_a,'tenant-a','atlas-pay',sha,payload) then raise exception 'initial record failed'; end if;
  if not public.atlas_record_certification_777(org_a,'tenant-a','atlas-pay',sha,payload) then raise exception 'idempotent replay failed'; end if;
  if (select count(*) from public.atlas_certification_audit_777) <> 1 then raise exception 'audit duplicated'; end if;
  if not public.atlas_record_certification_777(org_b,'tenant-b','atlas-pay',sha,payload) then raise exception 'tenant b record failed'; end if;
  if (select count(*) from public.atlas_certification_snapshot_777) <> 2 then raise exception 'tenant isolation failed'; end if;
  if public.atlas_record_certification_777(org_a,'tenant-a','atlas-pay',repeat('b',40),payload) then raise exception 'mismatched sha accepted'; end if;
  begin
    perform public.atlas_record_certification_777(org_a,'tenant-a','atlas-pay',sha,payload || '{"certified":true}'::jsonb);
    raise exception 'P0 bypass accepted';
  exception when check_violation then null;
  end;
  if (select count(*) from public.atlas_certification_audit_777) <> 2 then raise exception 'rejected writes changed audit'; end if;
end $$;
SQL
echo "PASS: isolated atomic certification assertions"
