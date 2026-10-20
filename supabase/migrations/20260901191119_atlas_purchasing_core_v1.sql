create or replace function public.can_write_purchasing_data(o uuid)
returns boolean
language sql
stable
set search_path to 'public','pg_temp'
as $$ select public.has_org_role(o,array['owner','admin','manager']) $$;

create table if not exists public.purchasing_vendors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  vendor_code text not null,
  name text not null,
  email text,
  phone text,
  payment_terms text,
  status text not null default 'active' check (status in ('active','inactive','blocked')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,vendor_code)
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  po_number text not null,
  vendor_id uuid not null references public.purchasing_vendors(id) on delete restrict,
  order_date date not null default current_date,
  expected_date date,
  currency text not null default 'USD',
  status text not null default 'draft' check (status in ('draft','submitted','approved','partially_received','received','closed','cancelled')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,po_number)
);

create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  item_id uuid references public.inventory_items(id) on delete restrict,
  description text not null,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_cost numeric(18,4) not null default 0 check (unit_cost >= 0),
  received_quantity numeric(18,3) not null default 0 check (received_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchasing_audit_events (
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

create index if not exists purchasing_vendors_org_idx on public.purchasing_vendors(org_id,status,name);
create index if not exists purchase_orders_org_idx on public.purchase_orders(org_id,status,order_date desc);
create index if not exists purchase_order_lines_po_idx on public.purchase_order_lines(org_id,purchase_order_id);
create index if not exists purchasing_audit_org_idx on public.purchasing_audit_events(org_id,created_at desc);

create or replace function public.audit_purchasing_change()
returns trigger
language plpgsql
security invoker
set search_path to 'public','pg_temp'
as $$
begin
  insert into public.purchasing_audit_events(org_id,entity_type,entity_id,action,before_state,after_state)
  values (
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

drop trigger if exists purchasing_vendors_audit on public.purchasing_vendors;
create trigger purchasing_vendors_audit after insert or update or delete on public.purchasing_vendors for each row execute function public.audit_purchasing_change();
drop trigger if exists purchase_orders_audit on public.purchase_orders;
create trigger purchase_orders_audit after insert or update or delete on public.purchase_orders for each row execute function public.audit_purchasing_change();
drop trigger if exists purchase_order_lines_audit on public.purchase_order_lines;
create trigger purchase_order_lines_audit after insert or update or delete on public.purchase_order_lines for each row execute function public.audit_purchasing_change();

alter table public.purchasing_vendors enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.purchasing_audit_events enable row level security;

create policy purchasing_vendors_read on public.purchasing_vendors for select to authenticated using (public.is_org_member(org_id));
create policy purchasing_vendors_write on public.purchasing_vendors for all to authenticated using (public.can_write_purchasing_data(org_id)) with check (public.can_write_purchasing_data(org_id));
create policy purchase_orders_read on public.purchase_orders for select to authenticated using (public.is_org_member(org_id));
create policy purchase_orders_write on public.purchase_orders for all to authenticated using (public.can_write_purchasing_data(org_id)) with check (public.can_write_purchasing_data(org_id));
create policy purchase_order_lines_read on public.purchase_order_lines for select to authenticated using (public.is_org_member(org_id));
create policy purchase_order_lines_write on public.purchase_order_lines for all to authenticated using (public.can_write_purchasing_data(org_id)) with check (public.can_write_purchasing_data(org_id));
create policy purchasing_audit_read on public.purchasing_audit_events for select to authenticated using (public.is_org_member(org_id));
create policy purchasing_audit_insert on public.purchasing_audit_events for insert to authenticated with check (public.can_write_purchasing_data(org_id));

grant select,insert,update,delete on public.purchasing_vendors to authenticated;
grant select,insert,update,delete on public.purchase_orders to authenticated;
grant select,insert,update,delete on public.purchase_order_lines to authenticated;
grant select,insert on public.purchasing_audit_events to authenticated;
