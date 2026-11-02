-- ATLAS 777 F12: isolated PostgreSQL 17 only. NEVER run on atlas-core.
-- Precondition: genuine foundation schema, grants and roles already loaded.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE n text; names text[] := ARRAY['audit_logs','identity_permissions','identity_role_permissions','organization_members','organization_modules','organization_role_permissions','organizations'];
BEGIN
 FOREACH n IN ARRAY names LOOP
  IF to_regclass(format('public.%I',n)) IS NULL THEN
   RAISE EXCEPTION 'P0_F12_MISSING_TABLE:%',n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.oid=to_regclass(format('public.%I',n)) AND c.relrowsecurity) THEN
   RAISE EXCEPTION 'P0_F12_RLS_DISABLED:%',n;
  END IF;
 END LOOP;
END $$;
REVOKE TRUNCATE ON TABLE public.audit_logs,public.identity_permissions,public.identity_role_permissions,public.organization_members,public.organization_modules,public.organization_role_permissions,public.organizations FROM anon,authenticated;
DO $$
DECLARE n text; names text[] := ARRAY['audit_logs','identity_permissions','identity_role_permissions','organization_members','organization_modules','organization_role_permissions','organizations']; oid regclass;
BEGIN
 FOREACH n IN ARRAY names LOOP
  oid := to_regclass(format('public.%I',n));
  IF has_table_privilege('anon',oid,'TRUNCATE') OR has_table_privilege('authenticated',oid,'TRUNCATE') THEN
   RAISE EXCEPTION 'P0_F12_TRUNCATE_STILL_GRANTED:%',n;
  END IF;
  IF NOT has_table_privilege('service_role',oid,'TRUNCATE') THEN
   RAISE EXCEPTION 'P0_F12_SERVICE_ROLE_REGRESSION:%',n;
  END IF;
 END LOOP;
END $$;
COMMIT;
