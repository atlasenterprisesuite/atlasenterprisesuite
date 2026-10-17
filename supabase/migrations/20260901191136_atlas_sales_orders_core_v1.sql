create or replace function public.can_write_sales_data(o uuid)
returns boolean language sql stable set search_path to 'public','pg_temp'
as $$ select public.has_org_role(o,array['owner','admin','manager']) $$;

create table if not exists public.sales_customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  customer_code text not null,
  name text not null,
  email text,
  phone text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,customer_code)
);

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  so_number text not null,
  customer_id uuid not null references public.sales_customers(id) on delete restrict,
  order_date date not null default current_date,
  requested_ship_date date,
  currency text not null default 'USD',
  status text not null default 'draft' check (status in ('draft','confirmed','allocated','partially_fulfilled','fulfilled','closed','cancelled')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,so_number)
);

create table if not exists public.sales_order_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  item_id uuid references public.inventory_items(id) on delete restrict,
  description text not null,
  quantity numeric(18,3) not null check(quantity>0),
  unit_price numeric(18,2) not null default 0 check(unit_price>=0),
  created_at timestamptz not null default now()
);

create table if not exists public.sales_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create or replace function public.audit_sales_change() returns trigger language plpgsql security definer set search_path='public','pg_temp' as $$
begin
 insert into public.sales_audit_events(org_id,entity_type,entity_id,action,actor_id)
 values(coalesce(new.org_id,old.org_id),tg_table_name,coalesce(new.id,old.id),tg_op,auth.uid());
 return coalesce(new,old);
end $$;

drop trigger if exists sales_customers_audit on public.sales_customers;
create trigger sales_customers_audit after insert or update or delete on public.sales_customers for each row execute function public.audit_sales_change();
drop trigger if exists sales_orders_audit on public.sales_orders;
create trigger sales_orders_audit after insert or update or delete on public.sales_orders for each row execute function public.audit_sales_change();
drop trigger if exists sales_order_lines_audit on public.sales_order_lines;
create trigger sales_order_lines_audit after insert or update or delete on public.sales_order_lines for each row execute function public.audit_sales_change();

alter table public.sales_customers enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_lines enable row level security;
alter table public.sales_audit_events enable row level security;

create policy sales_customers_read on public.sales_customers for select to authenticated using(public.is_org_member(org_id));
create policy sales_customers_write on public.sales_customers for all to authenticated using(public.can_write_sales_data(org_id)) with check(public.can_write_sales_data(org_id));
create policy sales_orders_read on public.sales_orders for select to authenticated using(public.is_org_member(org_id));
create policy sales_orders_write on public.sales_orders for all to authenticated using(public.can_write_sales_data(org_id)) with check(public.can_write_sales_data(org_id));
create policy sales_order_lines_read on public.sales_order_lines for select to authenticated using(public.is_org_member(org_id));
create policy sales_order_lines_write on public.sales_order_lines for all to authenticated using(public.can_write_sales_data(org_id)) with check(public.can_write_sales_data(org_id));
create policy sales_audit_read on public.sales_audit_events for select to authenticated using(public.is_org_member(org_id));

grant select,insert,update,delete on public.sales_customers,public.sales_orders,public.sales_order_lines to authenticated;
grant select on public.sales_audit_events to authenticated;
