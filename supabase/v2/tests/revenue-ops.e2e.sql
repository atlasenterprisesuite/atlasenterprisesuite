begin;

-- Revenue Ops database acceptance contract. Must be safe to run repeatedly:
-- all fixtures are synthetic and rolled back at the end.

do $$
begin
  if to_regclass('public.revenue_accounts') is null then raise exception 'revenue_accounts is required'; end if;
  if to_regclass('public.revenue_opportunities') is null then raise exception 'revenue_opportunities is required'; end if;
  if to_regclass('public.revenue_sales_orders') is null then raise exception 'revenue_sales_orders is required'; end if;
  if to_regclass('public.revenue_inventory_items') is null then raise exception 'revenue_inventory_items is required'; end if;
  if to_regclass('public.revenue_inventory_movements') is null then raise exception 'revenue_inventory_movements is required'; end if;
  if to_regclass('public.revenue_pos_transactions') is null then raise exception 'revenue_pos_transactions is required'; end if;
  if to_regclass('public.revenue_projects') is null then raise exception 'revenue_projects is required'; end if;
  if to_regprocedure('public.atlas_revenue_ops_self_check()') is null then raise exception 'atlas_revenue_ops_self_check is required'; end if;
end $$;

-- Revenue tables must remain RLS-protected and fail closed for direct client writes.
do $$
declare v_missing integer; v_unsafe integer;
begin
  select count(*) into v_missing
  from (values
    ('revenue_accounts'),('revenue_contacts'),('revenue_opportunities'),('revenue_sales_orders'),
    ('revenue_inventory_items'),('revenue_inventory_movements'),('revenue_pos_transactions'),('revenue_projects')
  ) e(name)
  where not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=e.name and c.relrowsecurity
  );
  if v_missing <> 0 then raise exception 'Revenue Ops RLS missing on % table(s)', v_missing; end if;

  select count(*) into v_unsafe
  from information_schema.role_table_grants g
  where g.table_schema='public' and g.grantee in ('anon','authenticated')
    and g.table_name like 'revenue_%'
    and g.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
  if v_unsafe <> 0 then raise exception 'Revenue Ops exposes % unsafe direct client grant(s)', v_unsafe; end if;
end $$;

create temp table revenue_ops_e2e_scope(
  label text primary key,
  user_id uuid not null,
  tenant_id uuid,
  org_id uuid
) on commit drop;

grant select on revenue_ops_e2e_scope to authenticated, service_role;
grant update on revenue_ops_e2e_scope to service_role;

insert into revenue_ops_e2e_scope(label,user_id)
values ('A',gen_random_uuid()),('B',gen_random_uuid());

insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
select user_id,'authenticated','authenticated',
  'atlas-revenue-e2e-'||lower(label)||'-'||substr(replace(user_id::text,'-',''),1,12)||'@invalid.local',
  '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), false, false
from revenue_ops_e2e_scope;

set local role service_role;
update revenue_ops_e2e_scope s
set (tenant_id,org_id)=(
  select b.tenant_id,b.organization_id
  from public.bootstrap_atlas_tenant_service(
    s.user_id,
    'ATLAS Revenue E2E Tenant '||s.label,
    'atlas-revenue-e2e-'||lower(s.label)||'-'||substr(replace(s.user_id::text,'-',''),1,12),
    'ATLAS Revenue E2E Org '||s.label,
    'atlas-revenue-e2e-org-'||lower(s.label)||'-'||substr(replace(s.user_id::text,'-',''),1,12)
  ) b
);
reset role;

-- User A may create/read inside its own scope but not B.
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from revenue_ops_e2e_scope where label='A'),true);
select set_config('request.jwt.claims',json_build_object('sub',(select user_id::text from revenue_ops_e2e_scope where label='A'),'role','authenticated')::text,true);

do $$
declare a record; b record; account_id uuid; opp_id uuid; order_id uuid; own_count integer; foreign_count integer; blocked boolean:=false;
begin
  select * into a from revenue_ops_e2e_scope where label='A';
  select * into b from revenue_ops_e2e_scope where label='B';

  account_id := public.revenue_create_account(a.tenant_id,a.org_id,'Revenue A','E2E-A');
  opp_id := public.revenue_create_opportunity(a.tenant_id,a.org_id,account_id,'Opportunity A',125000,'USD');
  perform public.revenue_transition_opportunity(a.tenant_id,a.org_id,opp_id,'qualified',null);
  order_id := public.revenue_create_sales_order(a.tenant_id,a.org_id,account_id,opp_id,'SO-E2E-A',100000,25000,'USD');

  if account_id is null or opp_id is null or order_id is null then raise exception 'Revenue Ops own-scope writes failed'; end if;

  select count(*), count(*) filter (where tenant_id=b.tenant_id)
    into own_count,foreign_count
  from public.revenue_accounts;
  if own_count <> 1 or foreign_count <> 0 then raise exception 'Revenue Ops RLS visibility failed'; end if;

  begin
    perform public.revenue_create_account(b.tenant_id,b.org_id,'Cross Tenant Attempt','E2E-X');
  exception when others then blocked:=true;
  end;
  if not blocked then raise exception 'Revenue Ops cross-tenant write unexpectedly succeeded'; end if;
end $$;
reset role;

-- Service-only aggregate self-check must be green and incorporated into backend gate.
set local role service_role;
do $$
declare failed integer; gate_failed bigint; gate_rows integer;
begin
  select count(*) into failed from public.atlas_revenue_ops_self_check() where not passed;
  if failed <> 0 then raise exception 'Revenue Ops self-check has % failure(s)',failed; end if;

  select count(*), coalesce(sum(failed_checks),0) into gate_rows,gate_failed
  from public.atlas_backend_gate()
  where component='revenue.ops';
  if gate_rows <> 1 or gate_failed <> 0 then raise exception 'Backend Gate missing/failed revenue.ops component'; end if;
end $$;
reset role;

rollback;
