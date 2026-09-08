create or replace function public.atlas_revenue_ops_self_check()
returns table(check_name text, passed boolean, detail text)
language plpgsql
security definer
set search_path = public, pg_catalog, information_schema, pg_temp
as $$
begin
  return query
  with expected_tables(name) as (
    values
      ('revenue_accounts'),('revenue_contacts'),('revenue_opportunities'),('revenue_sales_orders'),
      ('revenue_inventory_items'),('revenue_inventory_movements'),('revenue_pos_transactions'),('revenue_projects')
  ),
  expected_permissions(code) as (
    values
      ('revenue.crm.read'),('revenue.crm.manage'),('revenue.sales.read'),('revenue.sales.manage'),
      ('revenue.inventory.read'),('revenue.inventory.manage'),('revenue.pos.read'),('revenue.pos.manage'),
      ('revenue.projects.read'),('revenue.projects.manage')
  ),
  expected_modules(code) as (
    values ('revenue.crm'),('revenue.sales'),('revenue.inventory'),('revenue.pos'),('revenue.projects')
  ),
  expected_functions(signature) as (
    values
      ('public.revenue_create_account(uuid,uuid,text,text)'),
      ('public.revenue_create_opportunity(uuid,uuid,uuid,text,bigint,text)'),
      ('public.revenue_transition_opportunity(uuid,uuid,uuid,text,text)'),
      ('public.revenue_create_sales_order(uuid,uuid,uuid,uuid,text,bigint,bigint,text)'),
      ('public.revenue_record_inventory_movement(uuid,uuid,uuid,text,numeric,uuid,uuid,text,uuid)'),
      ('public.revenue_create_pos_transaction(uuid,uuid,text,bigint,text)')
  ),
  table_check as (
    select count(*) = 8 as ok
    from expected_tables e
    where exists (
      select 1 from information_schema.tables t
      where t.table_schema='public' and t.table_name=e.name
    )
  ),
  rls_check as (
    select count(*) = 8 as ok
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname in (select name from expected_tables)
      and c.relrowsecurity
  ),
  scope_check as (
    select count(*) = 16 as ok
    from information_schema.columns c
    where c.table_schema='public'
      and c.table_name in (select name from expected_tables)
      and c.column_name in ('tenant_id','org_id')
  ),
  direct_write_check as (
    select not exists (
      select 1 from information_schema.role_table_grants g
      where g.table_schema='public'
        and g.grantee in ('anon','authenticated')
        and g.table_name in (select name from expected_tables)
        and g.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
    ) as ok
  ),
  permission_check as (
    select count(*) = 10 as ok
    from expected_permissions e
    where exists (select 1 from public.identity_permissions p where p.code=e.code)
  ),
  owner_permission_check as (
    select count(*) = 10 as ok
    from expected_permissions e
    where exists (
      select 1 from public.identity_role_permissions rp
      where rp.role='owner' and rp.permission_code=e.code
    )
  ),
  module_check as (
    select count(*) = 5 as ok
    from expected_modules e
    where exists (select 1 from public.module_registry m where m.code=e.code and m.status='preview')
  ),
  rpc_check as (
    select count(*) = 6 as ok
    from expected_functions e
    where to_regprocedure(e.signature) is not null
      and has_function_privilege('authenticated',e.signature,'EXECUTE')
      and not has_function_privilege('anon',e.signature,'EXECUTE')
  )
  select 'revenue.tables',ok,case when ok then 'all Revenue Ops tables exist' else 'missing Revenue Ops table(s)' end from table_check
  union all
  select 'revenue.rls',ok,case when ok then 'RLS enabled on all Revenue Ops tables' else 'RLS missing on one or more Revenue Ops tables' end from rls_check
  union all
  select 'revenue.scope',ok,case when ok then 'tenant_id + org_id present on all Revenue Ops tables' else 'Revenue Ops scope column missing' end from scope_check
  union all
  select 'revenue.no_direct_client_writes',ok,case when ok then 'client writes are RPC-only' else 'unsafe direct client write grant detected' end from direct_write_check
  union all
  select 'revenue.permissions',ok,case when ok then 'Revenue Ops permission catalog complete' else 'Revenue Ops permission catalog incomplete' end from permission_check
  union all
  select 'revenue.owner_permissions',ok,case when ok then 'owner role covers Revenue Ops permissions' else 'owner Revenue Ops permission gap detected' end from owner_permission_check
  union all
  select 'revenue.modules',ok,case when ok then 'Revenue Ops modules registered in preview' else 'Revenue Ops module registry incomplete' end from module_check
  union all
  select 'revenue.rpc_grants',ok,case when ok then 'Revenue Ops RPC grants are authenticated-only' else 'Revenue Ops RPC grant/function mismatch' end from rpc_check;
end;
$$;

revoke all on function public.atlas_revenue_ops_self_check() from public, anon, authenticated;
grant execute on function public.atlas_revenue_ops_self_check() to service_role;
