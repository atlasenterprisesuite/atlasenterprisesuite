-- Read-only PostgreSQL catalog inspection for an authorized disposable clone ONLY.
-- Invoke with psql -X -v ON_ERROR_STOP=1 -f this-file on a verified local clone.
BEGIN READ ONLY;
WITH targets AS (
 SELECT c.oid,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
        pg_get_userbyid(c.relowner) AS owner
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('organization_members','audit_logs')
)
SELECT * FROM targets ORDER BY relname;
SELECT c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod) AS data_type,
       a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_expression
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
WHERE n.nspname='public' AND c.relname IN ('organization_members','audit_logs')
ORDER BY c.relname,a.attnum;
SELECT c.relname,con.conname,con.contype,pg_get_constraintdef(con.oid,true) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('organization_members','audit_logs')
ORDER BY c.relname,con.conname;
SELECT t.relname AS table_name,i.relname AS index_name,pg_get_indexdef(i.oid) AS definition,
       ix.indisunique,ix.indisprimary,ix.indisvalid
FROM pg_index ix JOIN pg_class t ON t.oid=ix.indrelid
JOIN pg_class i ON i.oid=ix.indexrelid JOIN pg_namespace n ON n.oid=t.relnamespace
WHERE n.nspname='public' AND t.relname IN ('organization_members','audit_logs')
ORDER BY t.relname,i.relname;
SELECT tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' AND tablename IN ('organization_members','audit_logs')
ORDER BY tablename,policyname;
SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid,true) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('organization_members','audit_logs')
AND NOT t.tgisinternal ORDER BY c.relname,t.tgname;
SELECT table_name,grantee,privilege_type,is_grantable
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name IN ('organization_members','audit_logs')
ORDER BY table_name,grantee,privilege_type;
-- Security metadata: ACLs and effective role privileges (inspect only).
SELECT c.relname,c.relacl,n.nspacl,pg_get_userbyid(c.relowner) AS table_owner
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('organization_members','audit_logs');
SELECT r.rolname,r.rolinherit,r.rolbypassrls,
       c.relname AS table_name,
       has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,
       has_table_privilege(r.oid,c.oid,'INSERT') AS can_insert,
       has_table_privilege(r.oid,c.oid,'UPDATE') AS can_update,
       has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete,
       has_schema_privilege(r.oid,n.oid,'USAGE') AS can_use_schema
FROM pg_roles r CROSS JOIN pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('organization_members','audit_logs')
AND r.rolname IN ('anon','authenticated','service_role')
ORDER BY r.rolname,c.relname;
SELECT r.rolname AS member_role, parent.rolname AS granted_role, m.admin_option
FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member
JOIN pg_roles parent ON parent.oid=m.roleid
WHERE r.rolname IN ('anon','authenticated','service_role')
ORDER BY r.rolname,parent.rolname;
SELECT d.defaclrole::regrole::text AS owner_role,n.nspname AS schema_name,
       d.defaclobjtype,d.defaclacl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
WHERE n.nspname='public' OR d.defaclnamespace=0
ORDER BY owner_role,schema_name,defaclobjtype;
SELECT p.oid::regprocedure::text AS function_signature,
       pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proacl,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f'
AND (p.prosrc ILIKE '%organization_members%'
     OR p.prosrc ILIKE '%audit_logs%')
ORDER BY function_signature;
ROLLBACK;
