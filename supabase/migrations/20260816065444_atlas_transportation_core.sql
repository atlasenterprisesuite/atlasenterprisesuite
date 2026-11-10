create extension if not exists pgcrypto;

create table if not exists public.transport_vehicles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  unit_code text not null,
  make text,
  model text,
  year integer,
  vin text,
  plate text,
  status text not null default 'active',
  odometer numeric,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, unit_code)
);
create index if not exists transport_vehicles_org_idx on public.transport_vehicles(org_id);

create table if not exists public.transport_drivers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid,
  full_name text not null,
  phone text,
  email text,
  license_number text,
  license_state text,
  status text not null default 'active',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists transport_drivers_org_idx on public.transport_drivers(org_id);

create table if not exists public.transport_trips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  trip_code text not null,
  vehicle_id uuid references public.transport_vehicles(id) on delete set null,
  driver_id uuid references public.transport_drivers(id) on delete set null,
  origin text,
  destination text,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  distance_miles numeric,
  status text not null default 'scheduled',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, trip_code)
);
create index if not exists transport_trips_org_idx on public.transport_trips(org_id);
create index if not exists transport_trips_vehicle_idx on public.transport_trips(vehicle_id);
create index if not exists transport_trips_driver_idx on public.transport_trips(driver_id);

alter table public.transport_vehicles enable row level security;
alter table public.transport_drivers enable row level security;
alter table public.transport_trips enable row level security;

create policy transport_vehicles_read on public.transport_vehicles for select to authenticated using (is_org_member(org_id));
create policy transport_vehicles_write on public.transport_vehicles for all to authenticated using (has_org_role(org_id, array['owner'::text,'admin'::text])) with check (has_org_role(org_id, array['owner'::text,'admin'::text]));

create policy transport_drivers_read on public.transport_drivers for select to authenticated using (is_org_member(org_id));
create policy transport_drivers_write on public.transport_drivers for all to authenticated using (has_org_role(org_id, array['owner'::text,'admin'::text])) with check (has_org_role(org_id, array['owner'::text,'admin'::text]));

create policy transport_trips_read on public.transport_trips for select to authenticated using (is_org_member(org_id));
create policy transport_trips_write on public.transport_trips for all to authenticated using (has_org_role(org_id, array['owner'::text,'admin'::text])) with check (has_org_role(org_id, array['owner'::text,'admin'::text]));

grant select,insert,update,delete on public.transport_vehicles, public.transport_drivers, public.transport_trips to authenticated;
