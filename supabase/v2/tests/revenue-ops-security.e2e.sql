begin;

do $$
declare unsafe_count integer;
begin
  select count(*) into unsafe_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'revenue_create_account',
      'revenue_create_opportunity',
      'revenue_transition_opportunity',
      'revenue_create_sales_order',
      'revenue_record_inventory_movement',
      'revenue_create_pos_transaction'
    )
    and p.prosecdef;

  if unsafe_count <> 0 then
    raise exception 'Revenue Ops exposes % SECURITY DEFINER RPC(s) in public schema', unsafe_count;
  end if;
end $$;

rollback;
