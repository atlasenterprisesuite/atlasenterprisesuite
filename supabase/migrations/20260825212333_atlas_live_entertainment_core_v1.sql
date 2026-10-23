create table if not exists public.live_entertainment_sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country_code text not null default 'US',
  timezone text not null default 'America/New_York',
  status text not null default 'active' check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code),
  unique (org_id, id)
);

create table if not exists public.live_entertainment_spaces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null,
  parent_space_id uuid,
  code text not null,
  name text not null,
  space_type text not null default 'room' check (space_type in ('warehouse','zone','rack','shelf','bin','studio','stage','rehearsal_room','workshop','office','meeting_room','loading_dock','other')),
  capacity integer check (capacity is null or capacity >= 0),
  reservable boolean not null default false,
  status text not null default 'active' check (status in ('active','maintenance','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code),
  unique (org_id, id),
  constraint live_entertainment_spaces_site_fk foreign key (org_id, site_id) references public.live_entertainment_sites(org_id, id) on delete cascade,
  constraint live_entertainment_spaces_parent_fk foreign key (org_id, parent_space_id) references public.live_entertainment_spaces(org_id, id) on delete set null
);

create table if not exists public.live_entertainment_productions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  production_type text not null default 'opera' check (production_type in ('opera','concert','recital','education','community','rental','event','other')),
  status text not null default 'planning' check (status in ('planning','pre_production','rehearsal','technical','performing','closeout','completed','cancelled','archived')),
  start_date date,
  end_date date,
  budget_amount numeric(14,2) check (budget_amount is null or budget_amount >= 0),
  currency text not null default 'USD',
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code),
  unique (org_id, id),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.live_entertainment_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  asset_code text not null,
  qr_value text,
  barcode_value text,
  rfid_value text,
  name text not null,
  category text not null default 'other' check (category in ('costume','prop','scenery','furniture','lighting','audio','video','music','tool','electronics','supply','other')),
  description text,
  current_space_id uuid,
  current_production_id uuid,
  condition text not null default 'good' check (condition in ('new','excellent','good','fair','poor','damaged','retired')),
  availability text not null default 'available' check (availability in ('available','reserved','checked_out','in_use','maintenance','lost','retired')),
  acquisition_cost numeric(14,2) check (acquisition_cost is null or acquisition_cost >= 0),
  replacement_value numeric(14,2) check (replacement_value is null or replacement_value >= 0),
  acquired_on date,
  photo_document_id uuid references public.documents(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, asset_code),
  unique (org_id, id),
  constraint live_entertainment_assets_space_fk foreign key (org_id, current_space_id) references public.live_entertainment_spaces(org_id, id) on delete set null,
  constraint live_entertainment_assets_production_fk foreign key (org_id, current_production_id) references public.live_entertainment_productions(org_id, id) on delete set null
);

create table if not exists public.live_entertainment_asset_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null,
  movement_type text not null check (movement_type in ('receive','move','reserve','checkout','checkin','assign_production','release_production','maintenance_out','maintenance_in','condition_change','lost','found','retire')),
  from_space_id uuid,
  to_space_id uuid,
  production_id uuid,
  condition_before text,
  condition_after text,
  note text,
  actor_user_id uuid default auth.uid() references auth.users(id),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint live_entertainment_asset_movements_asset_fk foreign key (org_id, asset_id) references public.live_entertainment_assets(org_id, id) on delete cascade,
  constraint live_entertainment_asset_movements_from_space_fk foreign key (org_id, from_space_id) references public.live_entertainment_spaces(org_id, id) on delete set null,
  constraint live_entertainment_asset_movements_to_space_fk foreign key (org_id, to_space_id) references public.live_entertainment_spaces(org_id, id) on delete set null,
  constraint live_entertainment_asset_movements_production_fk foreign key (org_id, production_id) references public.live_entertainment_productions(org_id, id) on delete set null
);

create table if not exists public.live_entertainment_reservations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  space_id uuid not null,
  production_id uuid,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('tentative','confirmed','cancelled','completed')),
  reserved_by uuid default auth.uid() references auth.users(id),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  constraint live_entertainment_reservations_space_fk foreign key (org_id, space_id) references public.live_entertainment_spaces(org_id, id) on delete cascade,
  constraint live_entertainment_reservations_production_fk foreign key (org_id, production_id) references public.live_entertainment_productions(org_id, id) on delete set null
);

create index if not exists idx_live_entertainment_spaces_org_site on public.live_entertainment_spaces(org_id, site_id);
create index if not exists idx_live_entertainment_assets_org_space on public.live_entertainment_assets(org_id, current_space_id);
create index if not exists idx_live_entertainment_assets_org_production on public.live_entertainment_assets(org_id, current_production_id);
create index if not exists idx_live_entertainment_assets_qr on public.live_entertainment_assets(org_id, qr_value) where qr_value is not null;
create index if not exists idx_live_entertainment_asset_movements_asset_time on public.live_entertainment_asset_movements(org_id, asset_id, occurred_at desc);
create index if not exists idx_live_entertainment_reservations_space_time on public.live_entertainment_reservations(org_id, space_id, starts_at, ends_at);
create index if not exists idx_live_entertainment_productions_org_status on public.live_entertainment_productions(org_id, status);

alter table public.live_entertainment_sites enable row level security;
alter table public.live_entertainment_spaces enable row level security;
alter table public.live_entertainment_productions enable row level security;
alter table public.live_entertainment_assets enable row level security;
alter table public.live_entertainment_asset_movements enable row level security;
alter table public.live_entertainment_reservations enable row level security;

create policy live_entertainment_sites_read on public.live_entertainment_sites for select using (is_org_member(org_id));
create policy live_entertainment_sites_insert on public.live_entertainment_sites for insert with check (can_write_business_data(org_id));
create policy live_entertainment_sites_update on public.live_entertainment_sites for update using (can_write_business_data(org_id)) with check (can_write_business_data(org_id));
create policy live_entertainment_sites_delete on public.live_entertainment_sites for delete using (has_org_role(org_id, array['owner','admin','manager']::text[]));

create policy live_entertainment_spaces_read on public.live_entertainment_spaces for select using (is_org_member(org_id));
create policy live_entertainment_spaces_insert on public.live_entertainment_spaces for insert with check (can_write_business_data(org_id));
create policy live_entertainment_spaces_update on public.live_entertainment_spaces for update using (can_write_business_data(org_id)) with check (can_write_business_data(org_id));
create policy live_entertainment_spaces_delete on public.live_entertainment_spaces for delete using (has_org_role(org_id, array['owner','admin','manager']::text[]));

create policy live_entertainment_productions_read on public.live_entertainment_productions for select using (is_org_member(org_id));
create policy live_entertainment_productions_insert on public.live_entertainment_productions for insert with check (can_write_business_data(org_id));
create policy live_entertainment_productions_update on public.live_entertainment_productions for update using (can_write_business_data(org_id)) with check (can_write_business_data(org_id));
create policy live_entertainment_productions_delete on public.live_entertainment_productions for delete using (has_org_role(org_id, array['owner','admin','manager']::text[]));

create policy live_entertainment_assets_read on public.live_entertainment_assets for select using (is_org_member(org_id));
create policy live_entertainment_assets_insert on public.live_entertainment_assets for insert with check (can_write_business_data(org_id));
create policy live_entertainment_assets_update on public.live_entertainment_assets for update using (can_write_business_data(org_id)) with check (can_write_business_data(org_id));
create policy live_entertainment_assets_delete on public.live_entertainment_assets for delete using (has_org_role(org_id, array['owner','admin','manager']::text[]));

create policy live_entertainment_asset_movements_read on public.live_entertainment_asset_movements for select using (is_org_member(org_id));
create policy live_entertainment_asset_movements_insert on public.live_entertainment_asset_movements for insert with check (can_write_business_data(org_id));
create policy live_entertainment_asset_movements_update on public.live_entertainment_asset_movements for update using (has_org_role(org_id, array['owner','admin','manager']::text[])) with check (has_org_role(org_id, array['owner','admin','manager']::text[]));
create policy live_entertainment_asset_movements_delete on public.live_entertainment_asset_movements for delete using (has_org_role(org_id, array['owner','admin']::text[]));

create policy live_entertainment_reservations_read on public.live_entertainment_reservations for select using (is_org_member(org_id));
create policy live_entertainment_reservations_insert on public.live_entertainment_reservations for insert with check (can_write_business_data(org_id));
create policy live_entertainment_reservations_update on public.live_entertainment_reservations for update using (can_write_business_data(org_id)) with check (can_write_business_data(org_id));
create policy live_entertainment_reservations_delete on public.live_entertainment_reservations for delete using (has_org_role(org_id, array['owner','admin','manager']::text[]));

comment on table public.live_entertainment_assets is 'ATLAS Live Entertainment tenant-scoped physical production asset registry.';
comment on table public.live_entertainment_asset_movements is 'Append-oriented history for production asset custody, location, condition, and assignment changes.';
comment on table public.live_entertainment_reservations is 'Tenant-scoped facility and production space scheduling foundation.';
