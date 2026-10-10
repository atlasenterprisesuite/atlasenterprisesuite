create or replace function public.inventory_transfer(
  p_org_id uuid,
  p_item_id uuid,
  p_from_location_id uuid,
  p_to_location_id uuid,
  p_quantity numeric,
  p_reference text default null
) returns uuid
language plpgsql
security invoker
set search_path to 'public','pg_temp'
as $$
declare
  v_group uuid := gen_random_uuid();
  v_balance numeric(18,3);
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'inventory_quantity_must_be_positive'; end if;
  if p_from_location_id = p_to_location_id then raise exception 'inventory_transfer_locations_must_differ'; end if;
  if not public.can_write_inventory_data(p_org_id) then raise exception 'inventory_write_denied'; end if;
  if not exists(select 1 from public.inventory_items where id=p_item_id and org_id=p_org_id and status='active') then raise exception 'inventory_item_not_found'; end if;
  if not exists(select 1 from public.inventory_locations where id=p_from_location_id and org_id=p_org_id and status='active') then raise exception 'inventory_source_location_not_found'; end if;
  if not exists(select 1 from public.inventory_locations where id=p_to_location_id and org_id=p_org_id and status='active') then raise exception 'inventory_destination_location_not_found'; end if;
  select coalesce(sum(quantity),0) into v_balance from public.inventory_movements where org_id=p_org_id and item_id=p_item_id and location_id=p_from_location_id;
  if v_balance < p_quantity then raise exception 'inventory_insufficient_stock'; end if;
  insert into public.inventory_movements(org_id,item_id,location_id,movement_type,quantity,reference,transfer_group_id)
  values(p_org_id,p_item_id,p_from_location_id,'transfer_out',-p_quantity,p_reference,v_group);
  insert into public.inventory_movements(org_id,item_id,location_id,movement_type,quantity,reference,transfer_group_id)
  values(p_org_id,p_item_id,p_to_location_id,'transfer_in',p_quantity,p_reference,v_group);
  return v_group;
end;
$$;
revoke all on function public.inventory_transfer(uuid,uuid,uuid,uuid,numeric,text) from public, anon;
grant execute on function public.inventory_transfer(uuid,uuid,uuid,uuid,numeric,text) to authenticated;
