create or replace function public.can_write_inventory_data(o uuid)
returns boolean
language sql
stable
set search_path to 'public','pg_temp'
as $$ select public.has_identity_permission(o,'inventory.write') $$;
