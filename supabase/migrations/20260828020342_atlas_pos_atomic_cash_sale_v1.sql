create or replace function public.pos_complete_cash_sale(
  p_org_id uuid,
  p_location_id uuid,
  p_lines jsonb,
  p_cash_received numeric,
  p_customer_reference text default null,
  p_note text default null
) returns jsonb
language plpgsql
security invoker
set search_path to 'public','pg_temp'
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_order_number bigint;
  v_subtotal numeric(18,2) := 0;
  v_tax numeric(18,2) := 0;
  v_total numeric(18,2) := 0;
  v_row jsonb;
  v_catalog record;
  v_qty numeric(18,3);
  v_on_hand numeric(18,3);
  v_line_subtotal numeric(18,2);
  v_line_tax numeric(18,2);
  v_line_total numeric(18,2);
  v_seen int := 0;
begin
  if not public.has_identity_permission(p_org_id,'pos.write') then raise exception 'pos_write_denied'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines)=0 then raise exception 'pos_lines_required'; end if;
  if not exists(select 1 from public.inventory_locations where id=p_location_id and org_id=p_org_id and status='active') then raise exception 'pos_location_not_found'; end if;

  insert into public.pos_orders(id,org_id,location_id,status,payment_status,customer_reference,note)
  values(v_order_id,p_org_id,p_location_id,'open','unpaid',nullif(trim(p_customer_reference),''),nullif(trim(p_note),''));

  for v_row in select value from jsonb_array_elements(p_lines)
  loop
    v_seen := v_seen + 1;
    if v_seen > 200 then raise exception 'pos_too_many_lines'; end if;
    begin v_qty := (v_row->>'quantity')::numeric; exception when others then raise exception 'pos_invalid_quantity'; end;
    if v_qty is null or v_qty <= 0 then raise exception 'pos_invalid_quantity'; end if;

    select c.id,c.inventory_item_id,c.display_name,c.unit_price,c.tax_rate,c.location_id
      into v_catalog
      from public.pos_catalog_items c
      join public.inventory_items i on i.id=c.inventory_item_id and i.org_id=c.org_id and i.status='active'
      where c.id=(v_row->>'catalogItemId')::uuid and c.org_id=p_org_id and c.active=true
        and (c.location_id is null or c.location_id=p_location_id);
    if not found then raise exception 'pos_catalog_item_not_found'; end if;

    select coalesce(sum(quantity),0) into v_on_hand
      from public.inventory_movements
      where org_id=p_org_id and item_id=v_catalog.inventory_item_id and location_id=p_location_id;
    if v_on_hand < v_qty then raise exception 'pos_insufficient_stock:%',v_catalog.display_name; end if;

    v_line_subtotal := round(v_catalog.unit_price * v_qty,2);
    v_line_tax := round(v_line_subtotal * v_catalog.tax_rate,2);
    v_line_total := v_line_subtotal + v_line_tax;
    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax := v_tax + v_line_tax;
    v_total := v_total + v_line_total;

    insert into public.pos_order_lines(org_id,order_id,catalog_item_id,inventory_item_id,description,quantity,unit_price,tax_rate,line_subtotal,line_tax,line_total)
    values(p_org_id,v_order_id,v_catalog.id,v_catalog.inventory_item_id,v_catalog.display_name,v_qty,v_catalog.unit_price,v_catalog.tax_rate,v_line_subtotal,v_line_tax,v_line_total);

    insert into public.inventory_movements(org_id,item_id,location_id,movement_type,quantity,reference_type,reference_id,reference)
    values(p_org_id,v_catalog.inventory_item_id,p_location_id,'issue',-v_qty,'pos_order',v_order_id::text,'POS sale');
  end loop;

  if p_cash_received is null or p_cash_received < v_total then raise exception 'pos_insufficient_cash_received'; end if;

  update public.pos_orders set subtotal=v_subtotal,tax_total=v_tax,total=v_total,status='completed',payment_status='paid_cash',completed_at=now(),updated_at=now()
  where id=v_order_id and org_id=p_org_id
  returning order_number into v_order_number;

  insert into public.pos_tenders(org_id,order_id,method,amount,status)
  values(p_org_id,v_order_id,'cash',v_total,'recorded_cash');

  return jsonb_build_object('orderId',v_order_id,'orderNumber',v_order_number,'subtotal',v_subtotal,'tax',v_tax,'total',v_total,'cashReceived',p_cash_received,'change',round(p_cash_received-v_total,2),'paymentStatus','paid_cash');
end;
$$;
revoke all on function public.pos_complete_cash_sale(uuid,uuid,jsonb,numeric,text,text) from public,anon;
grant execute on function public.pos_complete_cash_sale(uuid,uuid,jsonb,numeric,text,text) to authenticated;
