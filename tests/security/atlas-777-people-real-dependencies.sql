-- ATLAS 777: prerequisite audit before loading the ORIGINAL People migration.
-- No synthetic substitute for auth.uid, permissions, or audit hooks is permitted.
-- Dependency provenance: People migration 20260923201500 inserts into
-- identity_permissions/identity_role_permissions and references organizations/auth.users.
-- Advisory migration 20260918031500 uses the same identity tables and
-- has_identity_permission(org_id, permission). Neither migration creates these prerequisites.
-- Load the original foundational Supabase/ATLAS migrations before this gate;
-- never turn missing prerequisites into permissive stubs.
\set ON_ERROR_STOP on
DO $$
DECLARE missing text[];
BEGIN
  SELECT array_agg(dep) INTO missing
  FROM unnest(ARRAY[
    'auth.users', 'public.organizations', 'public.identity_permissions',
    'public.identity_role_permissions', 'public.audit_row_change()',
    'public.has_identity_permission(uuid,text)', 'auth.uid()'
  ]) AS dep
  WHERE CASE WHEN dep LIKE '%(%' THEN to_regprocedure(dep) IS NULL
             ELSE to_regclass(dep) IS NULL END;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'P0_PEOPLE_REAL_MIGRATION_DEPENDENCIES_MISSING: %', missing;
  END IF;
END $$;
\echo PEOPLE_REAL_DEPENDENCIES_PRESENT
