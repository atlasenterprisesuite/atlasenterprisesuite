create or replace function public.atlas_foundation_self_check()
returns table(check_name text, passed boolean, detail text)
language plpgsql
security definer
set search_path = public, pg_catalog, information_schema, pg_temp
as $$
begin
  return query
  with expected_tables(name) as (
    values
      ('tenants'),
      ('organizations'),
      ('organization_members'),
      ('identity_permissions'),
      ('identity_role_permissions'),
      ('organization_role_permissions'),
      ('audit_logs'),
      ('module_registry'),
      ('organization_modules')
  ),
  table_check as (
    select count(*) = 9 as ok
    from expected_tables e
    where exists (
      select 1 from information_schema.tables t
      where t.table_schema = 'public' and t.table_name = e.name
    )
  ),
  rls_check as (
    select count(*) = 9 as ok
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'tenants','organizations','organization_members','identity_permissions',
        'identity_role_permissions','organization_role_permissions','audit_logs',
        'module_registry','organization_modules'
      )
      and c.relrowsecurity = true
  ),
  tenant_columns_check as (
    select count(*) = 5 as ok
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'tenant_id'
      and c.table_name in (
        'organizations','organization_members','organization_role_permissions',
        'audit_logs','organization_modules'
      )
  ),
  direct_write_check as (
    select not exists (
      select 1
      from information_schema.role_table_grants g
      where g.table_schema = 'public'
        and g.grantee = 'authenticated'
        and g.table_name in ('tenants','organizations','organization_members','audit_logs')
        and g.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
    ) as ok
  ),
  bootstrap_check as (
    select
      not has_function_privilege('anon', 'public.bootstrap_atlas_tenant_service(uuid,text,text,text,text)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.bootstrap_atlas_tenant_service(uuid,text,text,text,text)', 'EXECUTE')
      and has_function_privilege('service_role', 'public.bootstrap_atlas_tenant_service(uuid,text,text,text,text)', 'EXECUTE')
      as ok
  ),
  owner_permissions_check as (
    select not exists (
      select 1
      from public.identity_permissions p
      where not exists (
        select 1
        from public.identity_role_permissions rp
        where rp.role = 'owner' and rp.permission_code = p.code
      )
    ) as ok
  ),
  core_module_check as (
    select exists (
      select 1 from public.module_registry where code = 'core' and status = 'available'
    ) as ok
  )
  select 'foundation.tables', ok, case when ok then 'all required foundation tables exist' else 'missing foundation table(s)' end from table_check
  union all
  select 'foundation.rls', ok, case when ok then 'RLS enabled on all foundation tables' else 'RLS missing on one or more foundation tables' end from rls_check
  union all
  select 'foundation.tenant_scope', ok, case when ok then 'tenant_id present on all scoped foundation tables' else 'tenant scope column missing' end from tenant_columns_check
  union all
  select 'foundation.no_direct_client_writes', ok, case when ok then 'authenticated role has no direct writes to tenancy/audit core' else 'direct client write grant detected' end from direct_write_check
  union all
  select 'foundation.bootstrap_isolation', ok, case when ok then 'bootstrap is service-role only' else 'bootstrap execute privilege is unsafe' end from bootstrap_check
  union all
  select 'foundation.owner_permissions', ok, case when ok then 'owner role covers the complete foundation permission catalog' else 'owner permission gap detected' end from owner_permissions_check
  union all
  select 'foundation.core_module', ok, case when ok then 'core module is registered and available' else 'core module registry gap' end from core_module_check;
end;
$$;

revoke all on function public.atlas_foundation_self_check() from public, anon, authenticated;
grant execute on function public.atlas_foundation_self_check() to service_role;
