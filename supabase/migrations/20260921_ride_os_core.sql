create table if not exists public.ride_driver_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'onboarding'
    check (status in ('onboarding','active','suspended','inactive')),
  availability text not null default 'offline'
    check (availability in ('offline','online','on_trip')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ride_driver_profile_scope_check check (tenant_id = organization_id),
  unique (organization_id, user_id)
);

create table if not exists public.ride_vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid,
  display_name text not null check (length(trim(display_name)) > 0),
  vin text,
  license_plate text,
  status text not null default 'pending'
    check (status in ('pending','active','maintenance','suspended','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ride_vehicle_scope_check check (tenant_id = organization_id)
);

create unique index if not exists ride_vehicles_org_vin_unique
  on public.ride_vehicles (organization_id, vin)
  where vin is not null and length(trim(vin)) > 0;

create table if not exists public.ride_driver_vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_profile_id uuid not null references public.ride_driver_profiles(id) on delete cascade,
  vehicle_id uuid not null references public.ride_vehicles(id) on delete cascade,
  active boolean not null default true,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ride_driver_vehicle_scope_check check (tenant_id = organization_id)
);

create unique index if not exists ride_driver_vehicle_one_active
  on public.ride_driver_vehicle_assignments (organization_id, driver_profile_id)
  where active = true;

create table if not exists public.ride_trips (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requester_user_id uuid,
  driver_profile_id uuid references public.ride_driver_profiles(id) on delete restrict,
  vehicle_id uuid references public.ride_vehicles(id) on delete restrict,
  status text not null default 'requested'
    check (status in (
      'requested','offered','accepted','driver_en_route','arrived',
      'in_progress','completed','cancelled','no_show','disputed'
    )),
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  quoted_fare_minor bigint check (quoted_fare_minor is null or quoted_fare_minor >= 0),
  final_fare_minor bigint check (final_fare_minor is null or final_fare_minor >= 0),
  pricing_policy_reference text,
  payment_reference text,
  accounting_reference text,
  tax_reference text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ride_trip_scope_check check (tenant_id = organization_id)
);

create index if not exists ride_trips_org_status_created_idx
  on public.ride_trips (organization_id, status, created_at desc);

create index if not exists ride_trips_driver_status_idx
  on public.ride_trips (organization_id, driver_profile_id, status, created_at desc);

create table if not exists public.ride_trip_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trip_id uuid not null references public.ride_trips(id) on delete cascade,
  actor_user_id uuid,
  event_type text not null check (length(trim(event_type)) > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ride_trip_event_scope_check check (tenant_id = organization_id)
);

create index if not exists ride_trip_events_trip_created_idx
  on public.ride_trip_events (trip_id, created_at asc);

alter table public.ride_driver_profiles enable row level security;
alter table public.ride_vehicles enable row level security;
alter table public.ride_driver_vehicle_assignments enable row level security;
alter table public.ride_trips enable row level security;
alter table public.ride_trip_events enable row level security;

-- Browser writes stay closed until the dedicated Ride operations service lands.
-- Service-side operations must still scope every mutation by tenant/org and permission.
revoke all on public.ride_driver_profiles from authenticated;
revoke all on public.ride_vehicles from authenticated;
revoke all on public.ride_driver_vehicle_assignments from authenticated;
revoke all on public.ride_trips from authenticated;
revoke all on public.ride_trip_events from authenticated;

comment on table public.ride_driver_profiles is
  'Organization-scoped mobility driver state linked to ATLAS Identity; not a duplicate identity record.';
comment on table public.ride_vehicles is
  'Organization-scoped Ride vehicle records. Compliance evidence remains in shared compliance tables/storage.';
comment on table public.ride_trips is
  'Canonical ATLAS Ride trip source of truth. Payment, Accounting and Tax remain referenced external canonical domains.';
comment on table public.ride_trip_events is
  'Append-oriented mobility event evidence for the canonical trip lifecycle.';
