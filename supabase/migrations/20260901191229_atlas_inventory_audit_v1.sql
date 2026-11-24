create table if not exists public.inventory_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  actor_user_id uuid default auth.uid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists inventory_audit_org_idx on public.inventory_audit_events(org_id,created_at desc);

create or replace function public.audit_inventory_change()
returns trigger
language plpgsql
security invoker
set search_path to 'public','pg_temp'
as $$
begin
  insert into public.inventory_audit_events(org_id,entity_type,entity_id,action,before_state,after_state)
  values(
    coalesce(new.org_id,old.org_id),
    tg_table_name,
    coalesce(new.id,old.id),
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new,old);
end;
$$;

drop trigger if exists inventory_items_audit on public.inventory_items;
create trigger inventory_items_audit after insert or update or delete on public.inventory_items for each row execute function public.audit_inventory_change();
drop trigger if exists inventory_locations_audit on public.inventory_locations;
create trigger inventory_locations_audit after insert or update or delete on public.inventory_locations for each row execute function public.audit_inventory_change();
drop trigger if exists inventory_movements_audit on public.inventory_movements;
create trigger inventory_movements_audit after insert or update or delete on public.inventory_movements for each row execute function public.audit_inventory_change();

alter table public.inventory_audit_events enable row level security;
create policy inventory_audit_read on public.inventory_audit_events for select to authenticated using(public.is_org_member(org_id));
create policy inventory_audit_insert on public.inventory_audit_events for insert to authenticated with check(public.can_write_inventory_data(org_id));
grant select,insert on public.inventory_audit_events to authenticated;
