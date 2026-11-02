-- ATLAS WEB-777 F14: isolated PG17 ACL before/after harness.
-- NEVER run on atlas-core. Requires authentic schema, roles, RLS and ACL bootstrap.
-- Execute with psql -X -v ON_ERROR_STOP=1 -f tests/security/atlas-777-f14-acl-preservation-isolated.sql
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE f14_before ON COMMIT PRESERVE ROWS AS
SELECT c.relname, c.relowner, c.relrowsecurity, c.relforcerowsecurity,
       (SELECT coalesce(jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable),'[]'::jsonb)
        FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
        WHERE NOT (a.privilege_type='TRUNCATE' AND a.grantee IN ('anon'::regrole::oid,'authenticated'::regrole::oid))) AS other_acl,
       (SELECT coalesce(jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,p.polroles,p.polqual,p.polwithcheck) ORDER BY p.polname),'[]'::jsonb)
        FROM pg_policy p WHERE p.polrelid=c.oid) AS policies,
       has_table_privilege('service_role',c.oid,'TRUNCATE') AS service_truncate
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
('audit_logs','identity_permissions','identity_role_permissions','organization_members','organization_modules','organization_role_permissions','organizations');
DO $$
BEGIN
 IF (SELECT count(*) FROM f14_before) <> 7 THEN RAISE EXCEPTION 'P0_F14_INCOMPLETE_FOUNDATION'; END IF;
 IF EXISTS (SELECT 1 FROM f14_before WHERE NOT relrowsecurity OR NOT service_truncate) THEN RAISE EXCEPTION 'P0_F14_UNSAFE_BASELINE'; END IF;
END $$;
COMMIT;
-- RED: this assertion must succeed before the revocation (the bad privilege is present).
\set expected_truncate true
\ir atlas-777-f13-truncate-privilege-contract.sql
-- GREEN: the F12 migration must revoke only the two named roles.
\ir atlas-777-f12-truncate-revoke-isolated.sql
\set expected_truncate false
\ir atlas-777-f13-truncate-privilege-contract.sql
DO $$
DECLARE mismatch_count integer;
BEGIN
 SELECT count(*) INTO mismatch_count FROM f14_before b
 FULL JOIN (
  SELECT c.relname,c.relowner,c.relrowsecurity,c.relforcerowsecurity,
       (SELECT coalesce(jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable),'[]'::jsonb)
        FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
        WHERE NOT (a.privilege_type='TRUNCATE' AND a.grantee IN ('anon'::regrole::oid,'authenticated'::regrole::oid))) AS other_acl,
       (SELECT coalesce(jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,p.polroles,p.polqual,p.polwithcheck) ORDER BY p.polname),'[]'::jsonb)
        FROM pg_policy p WHERE p.polrelid=c.oid) AS policies,
       has_table_privilege('service_role',c.oid,'TRUNCATE') AS service_truncate
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN
('audit_logs','identity_permissions','identity_role_permissions','organization_members','organization_modules','organization_role_permissions','organizations')
 ) a USING(relname)
 WHERE b.relname IS NULL OR a.relname IS NULL
 OR ROW(b.relowner,b.relrowsecurity,b.relforcerowsecurity,b.other_acl,b.policies,b.service_truncate)
 IS DISTINCT FROM ROW(a.relowner,a.relrowsecurity,a.relforcerowsecurity,a.other_acl,a.policies,a.service_truncate);
 IF mismatch_count <> 0 THEN RAISE EXCEPTION 'P0_F14_ACL_OR_POLICY_REGRESSION:%',mismatch_count; END IF;
END $$;
\echo F14_ISOLATED_ACL_RED_GREEN_PASSED
