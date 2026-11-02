create or replace function public.can_write_pos_data(o uuid)
returns boolean
language sql
stable
set search_path to 'public','pg_temp'
as $$ select public.has_identity_permission(o,'pos.write') $$;

create table if not exists public.pos_catalog_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  location_id uuid references public.inventory_locations(id) on delete restrict,
  display_name text not null,
  unit_price numeric(18,2) not null check (unit_price >= 0),
  tax_rate numeric(7,6) not null default 0 check (tax_rate >= 0 and tax_rate <= 1),
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,inventory_item_id,location_id)
);
create index if not exists pos_catalog_org_active_idx on public.pos_catalog_items(org_id,active,display_name);

create table if not exists public.pos_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  location_id uuid references public.inventory_locations(id) on delete restrict,
  order_number bigint generated always as identity,
  status text not null default 'open' check (status in ('open','completed','void')),
  subtotal numeric(18,2) not null default 0 check (subtotal >= 0),
  tax_total numeric(18,2) not null default 0 check (tax_total >= 0),
  total numeric(18,2) not null default 0 check (total >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending_external','paid_cash','paid_external','refunded')),
  customer_reference text,
  note text,
  created_by uuid default auth.uid(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pos_orders_org_created_idx on public.pos_orders(org_id,created_at desc);

create table if not exists public.pos_order_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  order_id uuid not null references public.pos_orders(id) on delete cascade,
  catalog_item_id uuid references public.pos_catalog_items(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  description text not null,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_price numeric(18,2) not null check (unit_price >= 0),
  tax_rate numeric(7,6) not null default 0 check (tax_rate >= 0 and tax_rate <= 1),
  line_subtotal numeric(18,2) not null check (line_subtotal >= 0),
  line_tax numeric(18,2) not null check (line_tax >= 0),
  line_total numeric(18,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index if not exists pos_lines_org_order_idx on public.pos_order_lines(org_id,order_id);

create table if not exists public.pos_tenders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  order_id uuid not null references public.pos_orders(id) on delete restrict,
  method text not null check (method in ('cash','card','ach','wallet','other')),
  amount numeric(18,2) not null check (amount > 0),
  status text not null check (status in ('recorded_cash','pending_external','confirmed_external','failed','refunded')),
  provider text,
  provider_reference text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists pos_tenders_org_order_idx on public.pos_tenders(org_id,order_id,created_at desc);

alter table public.pos_catalog_items enable row level security;
alter table public.pos_orders enable row level security;
alter table public.pos_order_lines enable row level security;
alter table public.pos_tenders enable row level security;

create policy pos_catalog_read on public.pos_catalog_items for select to authenticated using (public.is_org_member(org_id));
create policy pos_catalog_insert on public.pos_catalog_items for insert to authenticated with check (public.can_write_pos_data(org_id));
create policy pos_catalog_update on public.pos_catalog_items for update to authenticated using (public.can_write_pos_data(org_id)) with check (public.can_write_pos_data(org_id));
create policy pos_catalog_delete on public.pos_catalog_items for delete to authenticated using (public.can_write_pos_data(org_id));
create policy pos_orders_read on public.pos_orders for select to authenticated using (public.is_org_member(org_id));
create policy pos_orders_insert on public.pos_orders for insert to authenticated with check (public.can_write_pos_data(org_id));
create policy pos_orders_update on public.pos_orders for update to authenticated using (public.can_write_pos_data(org_id)) with check (public.can_write_pos_data(org_id));
create policy pos_lines_read on public.pos_order_lines for select to authenticated using (public.is_org_member(org_id));
create policy pos_lines_insert on public.pos_order_lines for insert to authenticated with check (public.can_write_pos_data(org_id));
create policy pos_tenders_read on public.pos_tenders for select to authenticated using (public.is_org_member(org_id));
create policy pos_tenders_insert on public.pos_tenders for insert to authenticated with check (public.can_write_pos_data(org_id));
create policy pos_tenders_update on public.pos_tenders for update to authenticated using (public.can_write_pos_data(org_id)) with check (public.can_write_pos_data(org_id));

grant select,insert,update,delete on public.pos_catalog_items to authenticated;
grant select,insert,update on public.pos_orders to authenticated;
grant select,insert on public.pos_order_lines to authenticated;
grant select,insert,update on public.pos_tenders to authenticated;
