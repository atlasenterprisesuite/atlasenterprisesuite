begin;

create or replace function public.revenue_create_account(
  p_tenant_id uuid,
  p_org_id uuid,
  p_name text,
  p_external_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.atlas_is_org_member(p_tenant_id, p_org_id)
     or not public.has_identity_permission(p_tenant_id, p_org_id, 'revenue.crm.manage') then
    raise exception 'Permission denied';
  end if;
  if length(trim(coalesce(p_name,''))) = 0 then raise exception 'Account name required'; end if;

  insert into public.revenue_accounts(tenant_id, org_id, name, external_reference, created_by)
  values (p_tenant_id, p_org_id, trim(p_name), nullif(trim(coalesce(p_external_reference,'')),''), v_actor)
  returning id into v_id;

  insert into public.audit_logs(tenant_id, org_id, actor_id, action, entity_type, entity_id, after_state)
  values (p_tenant_id, p_org_id, v_actor, 'revenue.crm.account.create', 'revenue_account', v_id::text,
          jsonb_build_object('name', trim(p_name), 'external_reference', p_external_reference));
  return v_id;
end;
$$;

create or replace function public.revenue_create_opportunity(
  p_tenant_id uuid,
  p_org_id uuid,
  p_account_id uuid,
  p_name text,
  p_expected_value_cents bigint,
  p_currency text default 'USD'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.atlas_is_org_member(p_tenant_id, p_org_id)
     or not public.has_identity_permission(p_tenant_id, p_org_id, 'revenue.crm.manage') then
    raise exception 'Permission denied';
  end if;
  if p_expected_value_cents < 0 then raise exception 'Expected value cannot be negative'; end if;

  insert into public.revenue_opportunities(
    tenant_id, org_id, account_id, name, expected_value_cents, currency, created_by
  ) values (
    p_tenant_id, p_org_id, p_account_id, trim(p_name), p_expected_value_cents, upper(p_currency), v_actor
  ) returning id into v_id;

  insert into public.audit_logs(tenant_id, org_id, actor_id, action, entity_type, entity_id, after_state)
  values (p_tenant_id, p_org_id, v_actor, 'revenue.crm.opportunity.create', 'revenue_opportunity', v_id::text,
          jsonb_build_object('account_id', p_account_id, 'name', trim(p_name), 'expected_value_cents', p_expected_value_cents, 'currency', upper(p_currency)));
  return v_id;
end;
$$;

create or replace function public.revenue_transition_opportunity(
  p_tenant_id uuid,
  p_org_id uuid,
  p_opportunity_id uuid,
  p_stage text,
  p_lost_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(p_tenant_id, p_org_id, 'revenue.crm.manage') then raise exception 'Permission denied'; end if;
  if p_stage not in ('lead','qualified','proposal','negotiation','won','lost') then raise exception 'Invalid opportunity stage'; end if;
  if p_stage = 'lost' and length(trim(coalesce(p_lost_reason,''))) = 0 then raise exception 'Lost reason required'; end if;

  select to_jsonb(o) into v_before from public.revenue_opportunities o
   where o.id = p_opportunity_id and o.tenant_id = p_tenant_id and o.org_id = p_org_id for update;
  if v_before is null then raise exception 'Opportunity not found'; end if;

  update public.revenue_opportunities
     set stage = p_stage,
         lost_reason = case when p_stage = 'lost' then trim(p_lost_reason) else null end,
         updated_at = now()
   where id = p_opportunity_id and tenant_id = p_tenant_id and org_id = p_org_id;

  select to_jsonb(o) into v_after from public.revenue_opportunities o
   where o.id = p_opportunity_id and o.tenant_id = p_tenant_id and o.org_id = p_org_id;

  insert into public.audit_logs(tenant_id, org_id, actor_id, action, entity_type, entity_id, before_state, after_state)
  values (p_tenant_id, p_org_id, v_actor, 'revenue.crm.opportunity.transition', 'revenue_opportunity', p_opportunity_id::text, v_before, v_after);
end;
$$;

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
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_total bigint;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(p_tenant_id, p_org_id, 'revenue.sales.manage') then raise exception 'Permission denied'; end if;
  if p_subtotal_cents < 0 or p_tax_cents < 0 then raise exception 'Amounts cannot be negative'; end if;
  v_total := p_subtotal_cents + p_tax_cents;

  insert into public.revenue_sales_orders(
    tenant_id, org_id, account_id, opportunity_id, order_number, subtotal_cents, tax_cents, total_cents, currency, created_by
  ) values (
    p_tenant_id, p_org_id, p_account_id, p_opportunity_id, trim(p_order_number), p_subtotal_cents, p_tax_cents, v_total, upper(p_currency), v_actor
  ) returning id into v_id;

  insert into public.audit_logs(tenant_id, org_id, actor_id, action, entity_type, entity_id, after_state)
  values (p_tenant_id, p_org_id, v_actor, 'revenue.sales.order.create', 'revenue_sales_order', v_id::text,
          jsonb_build_object('account_id', p_account_id, 'opportunity_id', p_opportunity_id, 'order_number', trim(p_order_number), 'total_cents', v_total));
  return v_id;
end;
$$;

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
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(p_tenant_id, p_org_id, 'revenue.inventory.manage') then raise exception 'Permission denied'; end if;
  if p_movement_type not in ('receipt','issue','transfer','adjustment') then raise exception 'Invalid movement type'; end if;
  if p_quantity = 0 then raise exception 'Quantity cannot be zero'; end if;

  insert into public.revenue_inventory_movements(
    tenant_id, org_id, item_id, movement_type, quantity, from_location_id, to_location_id, reference_type, reference_id, created_by
  ) values (
    p_tenant_id, p_org_id, p_item_id, p_movement_type, p_quantity, p_from_location_id, p_to_location_id, p_reference_type, p_reference_id, v_actor
  ) returning id into v_id;

  insert into public.audit_logs(tenant_id, org_id, actor_id, action, entity_type, entity_id, after_state)
  values (p_tenant_id, p_org_id, v_actor, 'revenue.inventory.movement.create', 'revenue_inventory_movement', v_id::text,
          jsonb_build_object('item_id', p_item_id, 'movement_type', p_movement_type, 'quantity', p_quantity, 'reference_type', p_reference_type, 'reference_id', p_reference_id));
  return v_id;
end;
$$;

create or replace function public.revenue_create_pos_transaction(
  p_tenant_id uuid,
  p_org_id uuid,
  p_transaction_number text,
  p_total_cents bigint,
  p_currency text default 'USD'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(p_tenant_id, p_org_id, 'revenue.pos.manage') then raise exception 'Permission denied'; end if;
  if p_total_cents < 0 then raise exception 'Total cannot be negative'; end if;

  insert into public.revenue_pos_transactions(
    tenant_id, org_id, transaction_number, total_cents, currency, settlement_state, settlement_provider, created_by
  ) values (
    p_tenant_id, p_org_id, trim(p_transaction_number), p_total_cents, upper(p_currency), 'unconfigured', null, v_actor
  ) returning id into v_id;

  insert into public.audit_logs(tenant_id, org_id, actor_id, action, entity_type, entity_id, after_state)
  values (p_tenant_id, p_org_id, v_actor, 'revenue.pos.transaction.create', 'revenue_pos_transaction', v_id::text,
          jsonb_build_object('transaction_number', trim(p_transaction_number), 'total_cents', p_total_cents, 'settlement_state', 'unconfigured'));
  return v_id;
end;
$$;

revoke all on function public.revenue_create_account(uuid,uuid,text,text) from public, anon;
revoke all on function public.revenue_create_opportunity(uuid,uuid,uuid,text,bigint,text) from public, anon;
revoke all on function public.revenue_transition_opportunity(uuid,uuid,uuid,text,text) from public, anon;
revoke all on function public.revenue_create_sales_order(uuid,uuid,uuid,uuid,text,bigint,bigint,text) from public, anon;
revoke all on function public.revenue_record_inventory_movement(uuid,uuid,uuid,text,numeric,uuid,uuid,text,uuid) from public, anon;
revoke all on function public.revenue_create_pos_transaction(uuid,uuid,text,bigint,text) from public, anon;

grant execute on function public.revenue_create_account(uuid,uuid,text,text) to authenticated;
grant execute on function public.revenue_create_opportunity(uuid,uuid,uuid,text,bigint,text) to authenticated;
grant execute on function public.revenue_transition_opportunity(uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.revenue_create_sales_order(uuid,uuid,uuid,uuid,text,bigint,bigint,text) to authenticated;
grant execute on function public.revenue_record_inventory_movement(uuid,uuid,uuid,text,numeric,uuid,uuid,text,uuid) to authenticated;
grant execute on function public.revenue_create_pos_transaction(uuid,uuid,text,bigint,text) to authenticated;

commit;
