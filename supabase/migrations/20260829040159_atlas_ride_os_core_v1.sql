create or replace function public.can_manage_ride(o uuid)
returns boolean
language sql
stable
set search_path to 'public','pg_temp'
as $$ select public.has_org_role(o,array['owner','admin','manager']) $$;

create table if not exists public.ride_driver_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  availability_state text not null default 'offline' check (availability_state in ('offline','online','paused','suspended')),
  compliance_state text not null default 'incomplete' check (compliance_state in ('incomplete','pending_review','approved','suspended','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,user_id)
);

create table if not exists public.ride_zones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  code text not null,
  name text not null,
  market text not null,
  geometry_ref text,
  active boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,code),
  unique(org_id,id)
);

create table if not exists public.ride_driver_zone_preferences (
  org_id uuid not null,
  user_id uuid not null,
  zone_id uuid not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(org_id,user_id,zone_id),
  foreign key(org_id,zone_id) references public.ride_zones(org_id,id) on delete cascade
);

create table if not exists public.ride_vehicles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  year integer check (year is null or year between 1980 and 2100),
  make text,
  model text,
  plate text,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','inactive','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,user_id,plate)
);

create table if not exists public.ride_driver_preferences (
  org_id uuid not null,
  user_id uuid not null,
  rides_enabled boolean not null default true,
  deliveries_enabled boolean not null default false,
  shop_enabled boolean not null default false,
  notifications_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(org_id,user_id)
);

create table if not exists public.ride_mileage_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  trip_date date not null default current_date,
  miles numeric(12,2) not null check (miles > 0),
  source text not null default 'manual' check (source in ('manual','gps_provider','trip_provider')),
  purpose text,
  source_ref text,
  created_at timestamptz not null default now()
);
create index if not exists ride_mileage_entries_org_user_date_idx on public.ride_mileage_entries(org_id,user_id,trip_date desc);

create table if not exists public.ride_compliance_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  requirement_code text not null,
  preparation_state text not null default 'not_started' check (preparation_state in ('not_started','prepared','submitted')),
  verification_state text not null default 'unverified' check (verification_state in ('unverified','pending','verified','rejected','expired')),
  provider_ref text,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(org_id,user_id,requirement_code)
);

create table if not exists public.ride_incidents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  trip_id uuid,
  category text not null,
  notes text not null,
  status text not null default 'draft' check (status in ('draft','submitted','under_review','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ride_audit (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  actor_id uuid default auth.uid(),
  resource_type text not null,
  resource_id text,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists ride_audit_org_time_idx on public.ride_audit(org_id,occurred_at desc);

alter table public.ride_driver_profiles enable row level security;
alter table public.ride_zones enable row level security;
alter table public.ride_driver_zone_preferences enable row level security;
alter table public.ride_vehicles enable row level security;
alter table public.ride_driver_preferences enable row level security;
alter table public.ride_mileage_entries enable row level security;
alter table public.ride_compliance_items enable row level security;
alter table public.ride_incidents enable row level security;
alter table public.ride_audit enable row level security;

create policy ride_driver_profiles_read on public.ride_driver_profiles for select to authenticated using (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id)));
create policy ride_driver_profiles_insert on public.ride_driver_profiles for insert to authenticated with check (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id)));
create policy ride_driver_profiles_update on public.ride_driver_profiles for update to authenticated using (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id))) with check (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id)));

create policy ride_zones_read on public.ride_zones for select to authenticated using (public.is_org_member(org_id));
create policy ride_zones_write on public.ride_zones for all to authenticated using (public.can_manage_ride(org_id)) with check (public.can_manage_ride(org_id));

create policy ride_zone_preferences_all on public.ride_driver_zone_preferences for all to authenticated using (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id))) with check (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id)));
create policy ride_vehicles_all on public.ride_vehicles for all to authenticated using (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id))) with check (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id)));
create policy ride_preferences_all on public.ride_driver_preferences for all to authenticated using (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id))) with check (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id)));
create policy ride_mileage_all on public.ride_mileage_entries for all to authenticated using (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id))) with check (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id)));
create policy ride_compliance_read on public.ride_compliance_items for select to authenticated using (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id)));
create policy ride_compliance_insert on public.ride_compliance_items for insert to authenticated with check (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id)));
create policy ride_compliance_update on public.ride_compliance_items for update to authenticated using (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id))) with check (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id)));
create policy ride_incidents_all on public.ride_incidents for all to authenticated using (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id))) with check (public.is_org_member(org_id) and (user_id=auth.uid() or public.can_manage_ride(org_id)));
create policy ride_audit_read on public.ride_audit for select to authenticated using (public.can_manage_ride(org_id));
create policy ride_audit_insert on public.ride_audit for insert to authenticated with check (public.is_org_member(org_id) and actor_id=auth.uid());

grant select,insert,update on public.ride_driver_profiles to authenticated;
grant select,insert,update,delete on public.ride_zones to authenticated;
grant select,insert,update,delete on public.ride_driver_zone_preferences to authenticated;
grant select,insert,update,delete on public.ride_vehicles to authenticated;
grant select,insert,update,delete on public.ride_driver_preferences to authenticated;
grant select,insert,update,delete on public.ride_mileage_entries to authenticated;
grant select,insert,update on public.ride_compliance_items to authenticated;
grant select,insert,update,delete on public.ride_incidents to authenticated;
grant select,insert on public.ride_audit to authenticated;
