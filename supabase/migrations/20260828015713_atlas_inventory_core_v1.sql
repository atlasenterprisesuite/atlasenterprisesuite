create or replace function public.can_write_inventory_data(o uuid)
returns boolean
language sql
stable
set search_path to 'public','pg_temp'
as $$ select public.has_org_role(o,array['owner','admin','manager']) $$;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  sku text not null,
  name text not null,
  category text,
  unit text not null default 'each',
  reorder_level numeric(18,3) not null default 0 check (reorder_level >= 0),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,sku)
);
create index if not exists inventory_items_org_status_idx on public.inventory_items(org_id,status,sku);

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  code text not null,
  name text not null,
  location_type text not null default 'warehouse' check (location_type in ('warehouse','store','vehicle','room','virtual','other')),
  address text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,code)
);
create index if not exists inventory_locations_org_status_idx on public.inventory_locations(org_id,status,code);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  movement_type text not null check (movement_type in ('receipt','issue','adjustment','transfer_in','transfer_out')),
  quantity numeric(18,3) not null check (quantity <> 0),
  reference_type text,
  reference_id text,
  reference text,
  notes text,
  transfer_group_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists inventory_movements_org_item_location_idx on public.inventory_movements(org_id,item_id,location_id,created_at desc);
create index if not exists inventory_movements_transfer_idx on public.inventory_movements(transfer_group_id) where transfer_group_id is not null;

create table if not exists public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  count_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft','completed','void')),
  notes text,
  completed_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_counts_org_location_idx on public.inventory_counts(org_id,location_id,count_date desc);

create table if not exists public.inventory_count_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  count_id uuid not null references public.inventory_counts(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  system_quantity numeric(18,3) not null default 0,
  counted_quantity numeric(18,3) not null default 0,
  variance numeric(18,3) generated always as (counted_quantity-system_quantity) stored,
  adjustment_movement_id uuid references public.inventory_movements(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(count_id,item_id)
);
create index if not exists inventory_count_lines_org_count_idx on public.inventory_count_lines(org_id,count_id,item_id);

alter table public.inventory_items enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_counts enable row level security;
alter table public.inventory_count_lines enable row level security;

drop policy if exists inventory_items_read on public.inventory_items;
create policy inventory_items_read on public.inventory_items for select to authenticated using (public.is_org_member(org_id));
drop policy if exists inventory_items_insert on public.inventory_items;
create policy inventory_items_insert on public.inventory_items for insert to authenticated with check (public.can_write_inventory_data(org_id));
drop policy if exists inventory_items_update on public.inventory_items;
create policy inventory_items_update on public.inventory_items for update to authenticated using (public.can_write_inventory_data(org_id)) with check (public.can_write_inventory_data(org_id));
drop policy if exists inventory_items_delete on public.inventory_items;
create policy inventory_items_delete on public.inventory_items for delete to authenticated using (public.can_write_inventory_data(org_id));

drop policy if exists inventory_locations_read on public.inventory_locations;
create policy inventory_locations_read on public.inventory_locations for select to authenticated using (public.is_org_member(org_id));
drop policy if exists inventory_locations_insert on public.inventory_locations;
create policy inventory_locations_insert on public.inventory_locations for insert to authenticated with check (public.can_write_inventory_data(org_id));
drop policy if exists inventory_locations_update on public.inventory_locations;
create policy inventory_locations_update on public.inventory_locations for update to authenticated using (public.can_write_inventory_data(org_id)) with check (public.can_write_inventory_data(org_id));
drop policy if exists inventory_locations_delete on public.inventory_locations;
create policy inventory_locations_delete on public.inventory_locations for delete to authenticated using (public.can_write_inventory_data(org_id));

drop policy if exists inventory_movements_read on public.inventory_movements;
create policy inventory_movements_read on public.inventory_movements for select to authenticated using (public.is_org_member(org_id));
drop policy if exists inventory_movements_insert on public.inventory_movements;
create policy inventory_movements_insert on public.inventory_movements for insert to authenticated with check (public.can_write_inventory_data(org_id));

drop policy if exists inventory_counts_read on public.inventory_counts;
create policy inventory_counts_read on public.inventory_counts for select to authenticated using (public.is_org_member(org_id));
drop policy if exists inventory_counts_insert on public.inventory_counts;
create policy inventory_counts_insert on public.inventory_counts for insert to authenticated with check (public.can_write_inventory_data(org_id));
drop policy if exists inventory_counts_update on public.inventory_counts;
create policy inventory_counts_update on public.inventory_counts for update to authenticated using (public.can_write_inventory_data(org_id)) with check (public.can_write_inventory_data(org_id));

drop policy if exists inventory_count_lines_read on public.inventory_count_lines;
create policy inventory_count_lines_read on public.inventory_count_lines for select to authenticated using (public.is_org_member(org_id));
drop policy if exists inventory_count_lines_insert on public.inventory_count_lines;
create policy inventory_count_lines_insert on public.inventory_count_lines for insert to authenticated with check (public.can_write_inventory_data(org_id));
drop policy if exists inventory_count_lines_update on public.inventory_count_lines;
create policy inventory_count_lines_update on public.inventory_count_lines for update to authenticated using (public.can_write_inventory_data(org_id)) with check (public.can_write_inventory_data(org_id));

grant select,insert,update,delete on public.inventory_items to authenticated;
grant select,insert,update,delete on public.inventory_locations to authenticated;
grant select,insert on public.inventory_movements to authenticated;
grant select,insert,update on public.inventory_counts to authenticated;
grant select,insert,update on public.inventory_count_lines to authenticated;
