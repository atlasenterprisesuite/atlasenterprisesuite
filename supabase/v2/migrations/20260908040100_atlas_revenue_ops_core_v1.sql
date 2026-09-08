begin;

insert into public.identity_permissions(code, description) values
  ('revenue.crm.read', 'Read CRM accounts, contacts and opportunities'),
  ('revenue.crm.manage', 'Manage CRM accounts, contacts and opportunities'),
  ('revenue.sales.read', 'Read sales orders'),
  ('revenue.sales.manage', 'Manage sales orders'),
  ('revenue.inventory.read', 'Read inventory items and movements'),
  ('revenue.inventory.manage', 'Manage inventory items and movements'),
  ('revenue.pos.read', 'Read POS transactions'),
  ('revenue.pos.manage', 'Manage POS transactions'),
  ('revenue.projects.read', 'Read projects'),
  ('revenue.projects.manage', 'Manage projects')
on conflict (code) do nothing;

insert into public.identity_role_permissions(role, permission_code)
select role_name, permission_code
from (values
  ('owner','revenue.crm.read'),('owner','revenue.crm.manage'),
  ('owner','revenue.sales.read'),('owner','revenue.sales.manage'),
  ('owner','revenue.inventory.read'),('owner','revenue.inventory.manage'),
  ('owner','revenue.pos.read'),('owner','revenue.pos.manage'),
  ('owner','revenue.projects.read'),('owner','revenue.projects.manage'),
  ('admin','revenue.crm.read'),('admin','revenue.crm.manage'),
  ('admin','revenue.sales.read'),('admin','revenue.sales.manage'),
  ('admin','revenue.inventory.read'),('admin','revenue.inventory.manage'),
  ('admin','revenue.pos.read'),('admin','revenue.pos.manage'),
  ('admin','revenue.projects.read'),('admin','revenue.projects.manage'),
  ('manager','revenue.crm.read'),('manager','revenue.crm.manage'),
  ('manager','revenue.sales.read'),('manager','revenue.sales.manage'),
  ('manager','revenue.inventory.read'),('manager','revenue.projects.read'),
  ('staff','revenue.crm.read'),('staff','revenue.sales.read'),
  ('staff','revenue.inventory.read'),('staff','revenue.pos.read'),('staff','revenue.projects.read'),
  ('viewer','revenue.crm.read'),('viewer','revenue.sales.read'),
  ('viewer','revenue.inventory.read'),('viewer','revenue.projects.read')
) as defaults(role_name, permission_code)
on conflict do nothing;

insert into public.module_registry(code, family, display_name, status) values
  ('revenue.crm', 'revenue', 'CRM', 'preview'),
  ('revenue.sales', 'revenue', 'Sales', 'preview'),
  ('revenue.inventory', 'operations', 'Inventory', 'preview'),
  ('revenue.pos', 'revenue', 'Point of Sale', 'preview'),
  ('revenue.projects', 'operations', 'Projects', 'preview')
on conflict (code) do update set display_name = excluded.display_name, family = excluded.family;

create table public.revenue_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 200),
  external_reference text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id, org_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade
);

create table public.revenue_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  account_id uuid,
  display_name text not null check (length(trim(display_name)) between 1 and 200),
  email text,
  phone text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id, org_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  foreign key (account_id, tenant_id, org_id) references public.revenue_accounts(id, tenant_id, org_id) on delete cascade
);

create table public.revenue_opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  account_id uuid,
  name text not null check (length(trim(name)) between 1 and 200),
  stage text not null default 'lead' check (stage in ('lead','qualified','proposal','negotiation','won','lost')),
  expected_value_cents bigint not null default 0 check (expected_value_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  expected_close_date date,
  lost_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id, org_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  foreign key (account_id, tenant_id, org_id) references public.revenue_accounts(id, tenant_id, org_id) on delete restrict,
  check ((stage <> 'lost') or length(trim(coalesce(lost_reason,''))) > 0)
);

create table public.revenue_sales_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  account_id uuid not null,
  opportunity_id uuid,
  order_number text not null check (length(trim(order_number)) between 1 and 80),
  status text not null default 'draft' check (status in ('draft','approved','confirmed','fulfilled','cancelled')),
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, order_number),
  unique (id, tenant_id, org_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  foreign key (account_id, tenant_id, org_id) references public.revenue_accounts(id, tenant_id, org_id) on delete restrict,
  foreign key (opportunity_id, tenant_id, org_id) references public.revenue_opportunities(id, tenant_id, org_id) on delete set null,
  check (total_cents = subtotal_cents + tax_cents)
);

create table public.revenue_inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  sku text not null check (length(trim(sku)) between 1 and 80),
  name text not null check (length(trim(name)) between 1 and 200),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, sku),
  unique (id, tenant_id, org_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade
);

create table public.revenue_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  item_id uuid not null,
  movement_type text not null check (movement_type in ('receipt','issue','transfer','adjustment')),
  quantity numeric(18,4) not null check (quantity <> 0),
  from_location_id uuid,
  to_location_id uuid,
  reference_type text,
  reference_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, tenant_id, org_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  foreign key (item_id, tenant_id, org_id) references public.revenue_inventory_items(id, tenant_id, org_id) on delete restrict,
  check (movement_type <> 'transfer' or (from_location_id is not null and to_location_id is not null and from_location_id <> to_location_id))
);

create table public.revenue_pos_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  transaction_number text not null check (length(trim(transaction_number)) between 1 and 80),
  total_cents bigint not null check (total_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  settlement_state text not null default 'unconfigured' check (settlement_state in ('unconfigured','pending','settled','failed')),
  settlement_provider text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, transaction_number),
  unique (id, tenant_id, org_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  check (settlement_state = 'unconfigured' or length(trim(coalesce(settlement_provider,''))) > 0)
);

create table public.revenue_projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 200),
  status text not null default 'planned' check (status in ('planned','active','on_hold','completed','cancelled')),
  owner_employee_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id, org_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade
);

create index revenue_accounts_scope_idx on public.revenue_accounts(tenant_id, org_id, status, name);
create index revenue_contacts_scope_account_idx on public.revenue_contacts(tenant_id, org_id, account_id);
create index revenue_opportunities_scope_stage_idx on public.revenue_opportunities(tenant_id, org_id, stage, expected_close_date);
create index revenue_sales_orders_scope_status_idx on public.revenue_sales_orders(tenant_id, org_id, status, created_at desc);
create index revenue_inventory_items_scope_active_idx on public.revenue_inventory_items(tenant_id, org_id, active, sku);
create index revenue_inventory_movements_scope_item_idx on public.revenue_inventory_movements(tenant_id, org_id, item_id, created_at desc);
create index revenue_pos_transactions_scope_state_idx on public.revenue_pos_transactions(tenant_id, org_id, settlement_state, created_at desc);
create index revenue_projects_scope_status_idx on public.revenue_projects(tenant_id, org_id, status, created_at desc);

alter table public.revenue_accounts enable row level security;
alter table public.revenue_contacts enable row level security;
alter table public.revenue_opportunities enable row level security;
alter table public.revenue_sales_orders enable row level security;
alter table public.revenue_inventory_items enable row level security;
alter table public.revenue_inventory_movements enable row level security;
alter table public.revenue_pos_transactions enable row level security;
alter table public.revenue_projects enable row level security;

create policy revenue_accounts_read_scope on public.revenue_accounts for select to authenticated
using (public.atlas_is_org_member(tenant_id, org_id) and public.has_identity_permission(tenant_id, org_id, 'revenue.crm.read'));
create policy revenue_contacts_read_scope on public.revenue_contacts for select to authenticated
using (public.atlas_is_org_member(tenant_id, org_id) and public.has_identity_permission(tenant_id, org_id, 'revenue.crm.read'));
create policy revenue_opportunities_read_scope on public.revenue_opportunities for select to authenticated
using (public.atlas_is_org_member(tenant_id, org_id) and public.has_identity_permission(tenant_id, org_id, 'revenue.crm.read'));
create policy revenue_sales_orders_read_scope on public.revenue_sales_orders for select to authenticated
using (public.atlas_is_org_member(tenant_id, org_id) and public.has_identity_permission(tenant_id, org_id, 'revenue.sales.read'));
create policy revenue_inventory_items_read_scope on public.revenue_inventory_items for select to authenticated
using (public.atlas_is_org_member(tenant_id, org_id) and public.has_identity_permission(tenant_id, org_id, 'revenue.inventory.read'));
create policy revenue_inventory_movements_read_scope on public.revenue_inventory_movements for select to authenticated
using (public.atlas_is_org_member(tenant_id, org_id) and public.has_identity_permission(tenant_id, org_id, 'revenue.inventory.read'));
create policy revenue_pos_transactions_read_scope on public.revenue_pos_transactions for select to authenticated
using (public.atlas_is_org_member(tenant_id, org_id) and public.has_identity_permission(tenant_id, org_id, 'revenue.pos.read'));
create policy revenue_projects_read_scope on public.revenue_projects for select to authenticated
using (public.atlas_is_org_member(tenant_id, org_id) and public.has_identity_permission(tenant_id, org_id, 'revenue.projects.read'));

revoke all on public.revenue_accounts, public.revenue_contacts, public.revenue_opportunities,
  public.revenue_sales_orders, public.revenue_inventory_items, public.revenue_inventory_movements,
  public.revenue_pos_transactions, public.revenue_projects from anon, authenticated;

grant select on public.revenue_accounts, public.revenue_contacts, public.revenue_opportunities,
  public.revenue_sales_orders, public.revenue_inventory_items, public.revenue_inventory_movements,
  public.revenue_pos_transactions, public.revenue_projects to authenticated;

grant all on public.revenue_accounts, public.revenue_contacts, public.revenue_opportunities,
  public.revenue_sales_orders, public.revenue_inventory_items, public.revenue_inventory_movements,
  public.revenue_pos_transactions, public.revenue_projects to service_role;

commit;
