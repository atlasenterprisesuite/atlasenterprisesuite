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
ROLLBACK;
