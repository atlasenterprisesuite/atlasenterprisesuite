-- ATLAS 777 F13 — isolated PG17 RED/GREEN contract. NEVER run on atlas-core.
-- Run as an isolated DB owner AFTER authentic foundation and role bootstrap.
-- Mode RED: \set expected_truncate true
-- Mode GREEN: \set expected_truncate false
\set ON_ERROR_STOP on
\if :{?expected_truncate}
\else
  \echo P0_F13_EXPECTED_TRUNCATE_NOT_SET
  \quit 3
\endif
DO $f13$
DECLARE t text; oid oid; a boolean; b boolean; svc boolean;
BEGIN
 FOREACH t IN ARRAY ARRAY['audit_logs','identity_permissions','identity_role_permissions','organization_members','organization_modules','organization_role_permissions','organizations'] LOOP
  oid := to_regclass(format('public.%I',t));
  IF oid IS NULL THEN RAISE EXCEPTION 'P0_F13_MISSING_TABLE:%',t; END IF;
  SELECT relrowsecurity INTO STRICT a FROM pg_class WHERE pg_class.oid=oid;
  IF NOT a THEN RAISE EXCEPTION 'P0_F13_RLS_DISABLED:%',t; END IF;
  a := has_table_privilege('anon',oid,'TRUNCATE');
  b := has_table_privilege('authenticated',oid,'TRUNCATE');
  svc := has_table_privilege('service_role',oid,'TRUNCATE');
  IF NOT svc THEN RAISE EXCEPTION 'P0_F13_SERVICE_TRUNCATE_MISSING:%',t; END IF;
  IF a <> :'expected_truncate'::boolean OR b <> :'expected_truncate'::boolean THEN
    RAISE EXCEPTION 'P0_F13_TRUNCATE_STATE_MISMATCH:% anon=% authenticated=% expected=%',t,a,b,:'expected_truncate';
  END IF;
 END LOOP;
END $f13$;
