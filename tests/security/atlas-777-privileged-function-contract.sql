-- ATLAS 777: fail-closed assertions against the ORIGINAL migrated functions.
-- Run only after authentic Supabase + ATLAS bootstrap; no mock definitions.
\set ON_ERROR_STOP on
DO $$
DECLARE bad text;
BEGIN
  WITH expected(schema_name, function_name, args, definer, expected_path, allowed_roles) AS (
    VALUES
    ('atlas_private','is_org_member','uuid',true,'public, pg_temp',ARRAY['authenticated']::text[]),
    ('atlas_private','has_org_role','uuid, text[]',true,'public, pg_temp',ARRAY['authenticated']::text[]),
    ('public','is_org_member','uuid',false,'atlas_private, pg_temp',ARRAY['authenticated','service_role']::text[]),
    ('public','has_org_role','uuid, text[]',false,'atlas_private, pg_temp',ARRAY['authenticated','service_role']::text[]),
    ('public','has_identity_permission','uuid, text',false,'public, pg_temp',ARRAY['authenticated','service_role']::text[]),
    ('public','audit_row_change','',true,'public',ARRAY['service_role']::text[]),
    ('public','redact_atlas_audit_jsonb','jsonb',false,'public, pg_temp',ARRAY['service_role']::text[])
  ), findings AS (
    SELECT e.schema_name||'.'||e.function_name||'('||e.args||')' AS target,
      CASE WHEN p.oid IS NULL THEN 'missing'
        WHEN pg_get_userbyid(p.proowner) <> 'postgres' THEN 'owner'
        WHEN p.prosecdef IS DISTINCT FROM e.definer THEN 'security_definer'
        WHEN coalesce((select replace(split_part(cfg,'=',2),'"','') from unnest(p.proconfig) cfg where cfg like 'search_path=%'),'') <> e.expected_path THEN 'search_path'
        WHEN EXISTS (SELECT 1 FROM (VALUES ('anon'),('authenticated'),('service_role')) r(role_name)
          WHERE has_function_privilege(r.role_name, p.oid, 'EXECUTE') IS DISTINCT FROM (r.role_name=ANY(e.allowed_roles)))
          OR EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
                     WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') THEN 'execute_privileges'
        ELSE NULL END AS problem
    FROM expected e LEFT JOIN pg_namespace n ON n.nspname=e.schema_name
      LEFT JOIN pg_proc p ON p.pronamespace=n.oid AND p.proname=e.function_name
       AND p.oid=to_regprocedure(e.schema_name||'.'||e.function_name||'('||e.args||')')
  ) SELECT string_agg(target||':'||problem,'; ') INTO bad FROM findings WHERE problem IS NOT NULL;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'P0_PRIVILEGED_FUNCTION_CONTRACT_FAILURE: %',bad; END IF;
END $$;
\echo PRIVILEGED_FUNCTION_CONTRACT_OK
