-- ATLAS 777 / PR #978 - Disposable PostgreSQL 17 ACL mechanism test.
-- This is NOT a production-schema bootstrap, a Supabase Auth emulation,
-- an RLS isolation proof, or OAuth concurrent-revocation certification.
-- Only synthetic empty tables under atlas_777_acl_fixture are used.
-- No TRUNCATE command executes anywhere in this test.
\set ON_ERROR_STOP on
DO $atlas$
BEGIN
  IF current_database() <> 'atlas_777_truncate_fixture'
     OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  THEN
    RAISE EXCEPTION 'P0_WRONG_TARGET_OR_POSTGRES_VERSION';
  END IF;
END
$atlas$;

BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE ROLE authenticator NOLOGIN;
GRANT anon, authenticated TO authenticator;

CREATE SCHEMA atlas_777_acl_fixture;
CREATE TABLE atlas_777_acl_fixture.identity_permissions (code text PRIMARY KEY);
CREATE TABLE atlas_777_acl_fixture.organization_modules
  (org_id uuid NOT NULL, module_code text NOT NULL, PRIMARY KEY (org_id, module_code));
ALTER TABLE atlas_777_acl_fixture.identity_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas_777_acl_fixture.organization_modules ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA atlas_777_acl_fixture TO anon, authenticated, service_role;
-- Reproduce ONLY the observed direct TRUNCATE ACL condition on empty synthetic tables.
GRANT TRUNCATE ON TABLE
  atlas_777_acl_fixture.identity_permissions,
  atlas_777_acl_fixture.organization_modules
TO anon, authenticated, service_role;

DO $atlas$
DECLARE t regclass;
DECLARE r text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'atlas_777_acl_fixture.identity_permissions'::regclass,
    'atlas_777_acl_fixture.organization_modules'::regclass
  ] LOOP
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF NOT has_table_privilege(r, t, 'TRUNCATE') THEN
        RAISE EXCEPTION 'RED_CONDITION_MISSING: % %', r, t;
      END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'ACL_FIXTURE_RED_CONFIRMED: four direct TRUNCATE grants visible despite RLS';
END
$atlas$;

-- Identical privileges-only SQL to the reviewed candidate, scoped to fixture tables.
REVOKE TRUNCATE ON TABLE
  atlas_777_acl_fixture.identity_permissions,
  atlas_777_acl_fixture.organization_modules
FROM anon, authenticated;

DO $atlas$
DECLARE t regclass;
DECLARE r text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'atlas_777_acl_fixture.identity_permissions'::regclass,
    'atlas_777_acl_fixture.organization_modules'::regclass
  ] LOOP
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(r, t, 'TRUNCATE') THEN
        RAISE EXCEPTION 'P0_REVOKE_FAILED: % %', r, t;
      END IF;
      IF NOT has_schema_privilege(r, 'atlas_777_acl_fixture', 'USAGE') THEN
        RAISE EXCEPTION 'P0_SCHEMA_USAGE_CHANGED: %', r;
      END IF;
    END LOOP;
    IF NOT has_table_privilege('service_role', t, 'TRUNCATE')
       OR NOT has_table_privilege(current_user, t, 'TRUNCATE') THEN
      RAISE EXCEPTION 'P0_PRIVILEGED_ACCESS_DROPPED: %', t;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a
    WHERE n.nspname = 'atlas_777_acl_fixture'
      AND c.relname IN ('identity_permissions','organization_modules')
      AND a.grantee = 0
      AND a.privilege_type = 'TRUNCATE'
  ) THEN
    RAISE EXCEPTION 'P0_PUBLIC_TRUNCATE_GRANT';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'atlas_777_acl_fixture'
      AND c.relname IN ('identity_permissions','organization_modules')
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'P0_RLS_DISABLED';
  END IF;
  RAISE NOTICE 'ACL_FIXTURE_GREEN_CONFIRMED: 4/4 denied, service and owner retained, RLS unchanged';
END
$atlas$;

-- Validate the effective roles reached by the PostgREST-style authenticator role switch.
SET LOCAL ROLE authenticator;
SET LOCAL ROLE anon;
DO $atlas$
BEGIN
  IF current_user <> 'anon'
     OR has_table_privilege(current_user,'atlas_777_acl_fixture.identity_permissions','TRUNCATE')
     OR has_table_privilege(current_user,'atlas_777_acl_fixture.organization_modules','TRUNCATE')
  THEN
    RAISE EXCEPTION 'P0_ANON_ROLE_SWITCH_PRIVILEGE';
  END IF;
END
$atlas$;
RESET ROLE;
SET LOCAL ROLE authenticator;
SET LOCAL ROLE authenticated;
DO $atlas$
BEGIN
  IF current_user <> 'authenticated'
     OR has_table_privilege(current_user,'atlas_777_acl_fixture.identity_permissions','TRUNCATE')
     OR has_table_privilege(current_user,'atlas_777_acl_fixture.organization_modules','TRUNCATE')
  THEN
    RAISE EXCEPTION 'P0_AUTHENTICATED_ROLE_SWITCH_PRIVILEGE';
  END IF;
END
$atlas$;
RESET ROLE;
ROLLBACK;
\echo 'ACL_FIXTURE_ONLY_PASS: synthetic privilege semantics; NO real Auth/RLS/OAuth certification'
