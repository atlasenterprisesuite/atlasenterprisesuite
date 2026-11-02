-- ATLAS 777: prerequisite audit before loading the ORIGINAL People migration.
-- No synthetic substitute for auth.uid, permissions, or audit hooks is permitted.
\\set ON_ERROR_STOP on
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
\\echo PEOPLE_REAL_DEPENDENCIES_PRESENT
