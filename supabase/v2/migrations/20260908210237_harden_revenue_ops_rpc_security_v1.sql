alter function public.revenue_create_account(uuid,uuid,text,text) set schema private;
alter function public.revenue_create_opportunity(uuid,uuid,uuid,text,bigint,text) set schema private;
alter function public.revenue_transition_opportunity(uuid,uuid,uuid,text,text) set schema private;
alter function public.revenue_create_sales_order(uuid,uuid,uuid,uuid,text,bigint,bigint,text) set schema private;
alter function public.revenue_record_inventory_movement(uuid,uuid,uuid,text,numeric,uuid,uuid,text,uuid) set schema private;
alter function public.revenue_create_pos_transaction(uuid,uuid,text,bigint,text) set schema private;

create or replace function public.revenue_create_account(
  p_tenant_id uuid,
  p_org_id uuid,
  p_name text,
  p_external_reference text default null
)
returns uuid
language sql
security invoker
set search_path = public, private, pg_temp
as $$ select private.revenue_create_account($1,$2,$3,$4); $$;

create or replace function public.revenue_create_opportunity(
  p_tenant_id uuid,
  p_org_id uuid,
  p_account_id uuid,
  p_name text,
  p_expected_value_cents bigint,
  p_currency text default 'USD'
)
returns uuid
language sql
security invoker
set search_path = public, private, pg_temp
as $$ select private.revenue_create_opportunity($1,$2,$3,$4,$5,$6); $$;

create or replace function public.revenue_transition_opportunity(
  p_tenant_id uuid,
  p_org_id uuid,
  p_opportunity_id uuid,
  p_stage text,
  p_lost_reason text default null
)
returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$ select private.revenue_transition_opportunity($1,$2,$3,$4,$5); $$;

create or replace function public.revenue_create_sales_order(
  p_tenant_id uuid,
  p_org_id uuid,
  p_account_id uuid,
  p_opportunity_id uuid,
  p_order_number text,
  p_subtotal_cents bigint,
  p_tax_cents bigint,
  p_currency text default 'USD'
)
returns uuid
language sql
security invoker
set search_path = public, private, pg_temp
as $$ select private.revenue_create_sales_order($1,$2,$3,$4,$5,$6,$7,$8); $$;

create or replace function public.revenue_record_inventory_movement(
  p_tenant_id uuid,
  p_org_id uuid,
  p_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_from_location_id uuid default null,
  p_to_location_id uuid default null,
  p_reference_type text default null,
  p_reference_id uuid default null
)
returns uuid
language sql
security invoker
set search_path = public, private, pg_temp
as $$ select private.revenue_record_inventory_movement($1,$2,$3,$4,$5,$6,$7,$8,$9); $$;

create or replace function public.revenue_create_pos_transaction(
  p_tenant_id uuid,
  p_org_id uuid,
  p_transaction_number text,
  p_total_cents bigint,
  p_currency text default 'USD'
)
returns uuid
language sql
security invoker
set search_path = public, private, pg_temp
as $$ select private.revenue_create_pos_transaction($1,$2,$3,$4,$5); $$;

revoke all on function public.revenue_create_account(uuid,uuid,text,text) from public, anon;
revoke all on function public.revenue_create_opportunity(uuid,uuid,uuid,text,bigint,text) from public, anon;
revoke all on function public.revenue_transition_opportunity(uuid,uuid,uuid,text,text) from public, anon;
revoke all on function public.revenue_create_sales_order(uuid,uuid,uuid,uuid,text,bigint,bigint,text) from public, anon;
revoke all on function public.revenue_record_inventory_movement(uuid,uuid,uuid,text,numeric,uuid,uuid,text,uuid) from public, anon;
revoke all on function public.revenue_create_pos_transaction(uuid,uuid,text,bigint,text) from public, anon;

grant execute on function public.revenue_create_account(uuid,uuid,text,text) to authenticated, service_role;
grant execute on function public.revenue_create_opportunity(uuid,uuid,uuid,text,bigint,text) to authenticated, service_role;
grant execute on function public.revenue_transition_opportunity(uuid,uuid,uuid,text,text) to authenticated, service_role;
grant execute on function public.revenue_create_sales_order(uuid,uuid,uuid,uuid,text,bigint,bigint,text) to authenticated, service_role;
grant execute on function public.revenue_record_inventory_movement(uuid,uuid,uuid,text,numeric,uuid,uuid,text,uuid) to authenticated, service_role;
grant execute on function public.revenue_create_pos_transaction(uuid,uuid,text,bigint,text) to authenticated, service_role;

create or replace function public.atlas_revenue_ops_rpc_security_self_check()
returns table(check_name text, passed boolean, detail text)
language sql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  with public_rpc as (
    select count(*)::int as total,
           count(*) filter (where not p.prosecdef)::int as invoker_count,
           count(*) filter (where has_function_privilege('authenticated',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE'))::int as grant_count
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'revenue_create_account','revenue_create_opportunity','revenue_transition_opportunity',
        'revenue_create_sales_order','revenue_record_inventory_movement','revenue_create_pos_transaction'
      )
  ),
  private_rpc as (
    select count(*)::int as total,
           count(*) filter (where p.prosecdef)::int as definer_count,
           count(*) filter (where has_function_privilege('authenticated',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE'))::int as grant_count
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname in (
        'revenue_create_account','revenue_create_opportunity','revenue_transition_opportunity',
        'revenue_create_sales_order','revenue_record_inventory_movement','revenue_create_pos_transaction'
      )
  )
  select 'revenue.rpc_public_invoker', total=6 and invoker_count=6,
         case when total=6 and invoker_count=6 then 'all public Revenue Ops RPCs use SECURITY INVOKER' else 'public Revenue Ops RPC security mode mismatch' end
  from public_rpc
  union all
  select 'revenue.rpc_private_governed', total=6 and definer_count=6 and grant_count=6,
         case when total=6 and definer_count=6 and grant_count=6 then 'private implementations are SECURITY DEFINER and authenticated-only' else 'private Revenue Ops implementation/grant mismatch' end
  from private_rpc
  union all
  select 'revenue.rpc_public_grants', total=6 and grant_count=6,
         case when total=6 and grant_count=6 then 'public Revenue Ops wrappers are authenticated-only' else 'public Revenue Ops wrapper grant mismatch' end
  from public_rpc;
$$;

revoke all on function public.atlas_revenue_ops_rpc_security_self_check() from public, anon, authenticated;
grant execute on function public.atlas_revenue_ops_rpc_security_self_check() to service_role;

create or replace function public.atlas_backend_gate()
returns table(component text, total_checks bigint, passed_checks bigint, failed_checks bigint)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select 'foundation'::text, count(*)::bigint, count(*) filter (where passed)::bigint, count(*) filter (where not passed)::bigint from public.atlas_foundation_self_check()
  union all
  select 'identity'::text, count(*)::bigint, count(*) filter (where passed)::bigint, count(*) filter (where not passed)::bigint from public.atlas_identity_self_check()
  union all
  select 'accounting.ledger'::text, count(*)::bigint, count(*) filter (where passed)::bigint, count(*) filter (where not passed)::bigint from public.atlas_accounting_self_check()
  union all
  select 'accounting.arap'::text, count(*)::bigint, count(*) filter (where passed)::bigint, count(*) filter (where not passed)::bigint from public.atlas_accounting_arap_self_check()
  union all
  select 'accounting.bank'::text, count(*)::bigint, count(*) filter (where passed)::bigint, count(*) filter (where not passed)::bigint from public.atlas_accounting_bank_self_check()
  union all
  select 'accounting.assets_close'::text, count(*)::bigint, count(*) filter (where passed)::bigint, count(*) filter (where not passed)::bigint from public.atlas_accounting_assets_close_self_check()
  union all
  select 'revenue.ops'::text, count(*)::bigint, count(*) filter (where passed)::bigint, count(*) filter (where not passed)::bigint
  from (
    select * from public.atlas_revenue_ops_self_check()
    union all
    select * from public.atlas_revenue_ops_rpc_security_self_check()
  ) revenue_checks;
$$;
revoke all on function public.atlas_backend_gate() from public, anon, authenticated;
grant execute on function public.atlas_backend_gate() to service_role;