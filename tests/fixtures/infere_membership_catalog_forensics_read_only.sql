-- ATLAS 777 READ-ONLY CATALOG FORENSICS, NOT EXECUTED.
-- For disposable restored schema / explicitly approved read-only replica ONLY.
-- Never run on production by automation. Supply no credentials in script.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';
SELECT current_database() AS db, current_user AS inspected_by, version() AS server_version;
SELECT n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.relowner::regrole AS owner,
       c.relacl
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('organization_members','atlas_ai_emergency_budget_reservations')
ORDER BY c.relname;
SELECT n.nspname, c.relname, a.attnum, a.attname, pg_catalog.format_type(a.atttypid,a.atttypmod) AS type,
       a.attnotnull, pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS default_expr
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
WHERE n.nspname='public' AND c.relname IN ('organization_members','atlas_ai_emergency_budget_reservations')
 AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum;
SELECT con.conrelid::regclass AS table_name, con.conname, con.contype, pg_catalog.pg_get_constraintdef(con.oid) AS definition
FROM pg_catalog.pg_constraint con
WHERE con.conrelid IN ('public.organization_members'::regclass,'public.atlas_ai_emergency_budget_reservations'::regclass);
SELECT i.indrelid::regclass AS table_name, pg_catalog.pg_get_indexdef(i.indexrelid) AS index_sql
FROM pg_catalog.pg_index i
WHERE i.indrelid IN ('public.organization_members'::regclass,'public.atlas_ai_emergency_budget_reservations'::regclass);
SELECT t.tgrelid::regclass AS table_name, t.tgname, t.tgenabled, pg_catalog.pg_get_triggerdef(t.oid) AS trigger_sql
FROM pg_catalog.pg_trigger t WHERE NOT t.tgisinternal
 AND t.tgrelid IN ('public.organization_members'::regclass,'public.atlas_ai_emergency_budget_reservations'::regclass);
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_catalog.pg_policies WHERE schemaname='public'
 AND tablename IN ('organization_members','atlas_ai_emergency_budget_reservations')
 ORDER BY tablename,policyname;
SELECT p.oid::regprocedure AS function_name, p.prosecdef, p.proconfig, p.proacl,
 pg_catalog.pg_get_functiondef(p.oid) AS function_sql
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='atlas_reserve_ai_emergency_budget';
ROLLBACK;
