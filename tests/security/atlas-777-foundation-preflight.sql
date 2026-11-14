-- ATLAS 777 Foundation Preflight / P0 Fail Closed
-- Run ONLY against a disposable PostgreSQL 17 database with authentic Supabase Auth.
-- Read-only catalog checks. No stubs, grants, mutations or production access.
DO $atlas$
DECLARE missing text[];
BEGIN
  SELECT array_agg(dep ORDER BY dep) INTO missing
  FROM unnest(ARRAY[
    'auth.users','auth.uid()','public.organizations','public.organization_modules',
    'public.organization_members','public.identity_permissions',
    'public.identity_role_permissions','public.organization_role_permissions',
    'public.audit_logs','public.has_identity_permission(uuid,text)',
    'public.audit_row_change()','public.redact_atlas_audit_jsonb(jsonb)',
    'public.is_org_member(uuid)','public.has_org_role(uuid,text[])',
    'atlas_private.is_org_member(uuid)','atlas_private.has_org_role(uuid,text[])',
    'public.set_updated_at()','public.seed_atlas_work_modules()',
    'public.atlas_enforce_synthetic_e2e_role()'
  ]) AS dep
  WHERE CASE WHEN dep LIKE '%(%' THEN to_regprocedure(dep) IS NULL
             ELSE to_regclass(dep) IS NULL END;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'P0_FOUNDATION_DEPENDENCIES_MISSING: %',missing;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN
      ('organizations','organization_modules','organization_members',
       'identity_permissions','identity_role_permissions',
       'organization_role_permissions','audit_logs') AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'P0_FOUNDATION_RLS_DISABLED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid='public.audit_logs'::regclass
      AND a.attname='id' AND a.attidentity='a'
  ) THEN
    RAISE EXCEPTION 'P0_AUDIT_IDENTITY_NOT_AUTHENTIC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='atlas_private' AND p.proname IN ('is_org_member','has_org_role')
      AND NOT p.prosecdef
  ) THEN
    RAISE EXCEPTION 'P0_PRIVATE_MEMBERSHIP_SECURITY_CONTRACT_CHANGED';
  END IF;

  -- No P0 pass can be declared while direct TRUNCATE grants remain unresolved.
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN
      ('organizations','organization_modules','organization_members',
       'identity_permissions','identity_role_permissions',
       'organization_role_permissions','audit_logs')
      AND (has_table_privilege('anon',c.oid,'TRUNCATE')
        OR has_table_privilege('authenticated',c.oid,'TRUNCATE'))
  ) THEN
    RAISE EXCEPTION 'P0_FOUNDATION_TRUNCATE_PRIVILEGE_REVIEW_REQUIRED';
  END IF;
END
$atlas$;
