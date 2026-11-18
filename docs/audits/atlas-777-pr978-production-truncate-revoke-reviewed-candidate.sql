-- ATLAS 777 REVIEW / PR #978: REVIEW-ONLY candidate, NOT auto-applied.
-- Requires separate, explicit authorization for production mutation.
-- Precondition: production catalog check has verified the four exposed grants.
-- No DML, no TRUNCATE, no DROP, no role or RLS modification.
BEGIN;
DO $guard$
BEGIN
 IF to_regclass('public.identity_permissions') IS NULL OR to_regclass('public.organization_modules') IS NULL THEN
   RAISE EXCEPTION 'P0_ABORT: target table missing';
 END IF;
 IF NOT (SELECT bool_and(c.relrowsecurity) FROM pg_class c WHERE c.oid IN
 ('public.identity_permissions'::regclass,'public.organization_modules'::regclass)) THEN
   RAISE EXCEPTION 'P0_ABORT: expected RLS missing';
 END IF;
 IF NOT (has_table_privilege('service_role','public.identity_permissions','TRUNCATE')
     AND has_table_privilege('service_role','public.organization_modules','TRUNCATE')) THEN
   RAISE EXCEPTION 'P0_ABORT: service role baseline mismatch';
 END IF;
END $guard$;
REVOKE TRUNCATE ON TABLE public.identity_permissions, public.organization_modules FROM anon, authenticated;
DO $verify$
DECLARE t regclass;
BEGIN
 FOREACH t IN ARRAY ARRAY['public.identity_permissions'::regclass,'public.organization_modules'::regclass] LOOP
  IF has_table_privilege('anon',t,'TRUNCATE') OR has_table_privilege('authenticated',t,'TRUNCATE') THEN
   RAISE EXCEPTION 'P0_ABORT: effective TRUNCATE remains on %',t;
  END IF;
  IF NOT has_table_privilege('service_role',t,'TRUNCATE') THEN
   RAISE EXCEPTION 'P0_ABORT: service_role privilege lost on %',t;
  END IF;
 END LOOP;
END $verify$;
COMMIT;
-- Independent read-only post-change verification, once separately authorized and applied:
-- SELECT c.relname, r.rolname, has_table_privilege(r.rolname,c.oid,'TRUNCATE') AS can_truncate
-- FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
-- WHERE n.nspname='public' AND c.relname IN ('identity_permissions','organization_modules')
-- AND r.rolname IN ('anon','authenticated','service_role') ORDER BY c.relname,r.rolname;
