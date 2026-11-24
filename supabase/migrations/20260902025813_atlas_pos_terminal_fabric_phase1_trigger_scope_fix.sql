create or replace function public.validate_pos_terminal_scope()
returns trigger
language plpgsql
security invoker
set search_path='public','pg_temp'
as $$
declare
  v_register_location uuid;
  v_register_id uuid;
begin
  if new.location_id is not null and not exists(
    select 1 from public.inventory_locations l
    where l.id=new.location_id and l.org_id=new.org_id and l.status='active'
  ) then
    raise exception 'pos_terminal_location_scope_invalid';
  end if;

  if tg_table_name='pos_devices' then
    v_register_id := nullif(to_jsonb(new)->>'register_id','')::uuid;
    if v_register_id is not null then
      select r.location_id into v_register_location
      from public.pos_registers r
      where r.id=v_register_id and r.org_id=new.org_id;
      if not found then raise exception 'pos_terminal_register_scope_invalid'; end if;
      if new.location_id is null or new.location_id<>v_register_location then
        raise exception 'pos_terminal_register_location_mismatch';
      end if;
    end if;
  end if;
  return new;
end;
$$;
