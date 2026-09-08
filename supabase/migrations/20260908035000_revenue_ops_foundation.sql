begin;

create table public.revenue_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  external_reference text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id,id)
);

create table public.revenue_contacts (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid, display_name text not null check (btrim(display_name) <> ''), email text, phone text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (org_id,account_id) references public.revenue_accounts(org_id,id) on delete cascade,
  unique (org_id,id)
);

create table public.revenue_opportunities (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid, name text not null check (btrim(name) <> ''),
  stage text not null default 'lead' check (stage in ('lead','qualified','proposal','negotiation','won','lost')),
  expected_value_cents bigint not null default 0 check (expected_value_cents >= 0), currency text not null default 'USD',
  expected_close_date date, lost_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (org_id,account_id) references public.revenue_accounts(org_id,id) on delete restrict,
  unique (org_id,id)
);

create table public.revenue_sales_orders (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null, opportunity_id uuid, order_number text not null,
  status text not null default 'draft' check (status in ('draft','approved','confirmed','fulfilled','cancelled')),
  subtotal_cents bigint not null check (subtotal_cents >= 0), tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null check (total_cents >= 0), currency text not null default 'USD',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (org_id,account_id) references public.revenue_accounts(org_id,id) on delete restrict,
  foreign key (org_id,opportunity_id) references public.revenue_opportunities(org_id,id) on delete set null,
  unique (org_id,id), unique (org_id,order_number), check (total_cents = subtotal_cents + tax_cents)
);

create table public.revenue_inventory_items (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
  sku text not null check (btrim(sku) <> ''), name text not null check (btrim(name) <> ''), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id,id), unique (org_id,sku)
);

create table public.revenue_inventory_movements (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
  item_id uuid not null, movement_type text not null check (movement_type in ('receipt','issue','transfer','adjustment')),
  quantity numeric(18,4) not null check (quantity <> 0), from_location_id uuid, to_location_id uuid,
  reference_type text, reference_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (org_id,item_id) references public.revenue_inventory_items(org_id,id) on delete restrict,
  unique (org_id,id)
);

create table public.revenue_pos_transactions (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
  transaction_number text not null, total_cents bigint not null check (total_cents >= 0), currency text not null default 'USD',
  settlement_state text not null default 'unconfigured' check (settlement_state in ('unconfigured','pending','settled','failed')),
  settlement_provider text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id,id), unique (org_id,transaction_number),
  check (settlement_state = 'unconfigured' or settlement_provider is not null)
);

create table public.revenue_projects (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  status text not null default 'planned' check (status in ('planned','active','on_hold','completed','cancelled')),
  owner_employee_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (org_id,owner_employee_id) references public.employees(org_id,id) on delete set null,
  unique (org_id,id)
);

alter table public.revenue_accounts enable row level security;
alter table public.revenue_contacts enable row level security;
alter table public.revenue_opportunities enable row level security;
alter table public.revenue_sales_orders enable row level security;
alter table public.revenue_inventory_items enable row level security;
alter table public.revenue_inventory_movements enable row level security;
alter table public.revenue_pos_transactions enable row level security;
alter table public.revenue_projects enable row level security;

-- RLS policies and governed write RPCs are intentionally delivered in the follow-up migration after reusing the canonical Core membership/permission helpers.
commit;
