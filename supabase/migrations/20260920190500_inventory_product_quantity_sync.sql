-- Keep the legacy products.quantity projection synchronized with canonical inventory movements.
create or replace function public.sync_product_quantity_from_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.products
  set quantity = (
        select coalesce(sum(m.quantity), 0)
        from public.inventory_movements m
        where m.org_id = new.org_id
          and m.item_id = new.item_id
      ),
      updated_at = now()
  where org_id = new.org_id
    and inventory_item_id = new.item_id;

  return new;
end;
$$;

revoke all on function public.sync_product_quantity_from_inventory_movement() from public, anon;

drop trigger if exists trg_sync_product_quantity_from_inventory_movement
  on public.inventory_movements;

create trigger trg_sync_product_quantity_from_inventory_movement
after insert on public.inventory_movements
for each row
execute function public.sync_product_quantity_from_inventory_movement();
