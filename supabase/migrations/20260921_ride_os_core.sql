-- Extend the existing ATLAS Ride OS schema in place.
-- ride_driver_profiles and ride_vehicles already exist in production and remain canonical.

create unique index if not exists ride_driver_profiles_org_id_id_uq
  on public.ride_driver_profiles (org_id, id);

create unique index if not exists ride_vehicles_org_id_id_uq
  on public.ride_vehicles (org_id, id);

create table if not exists public.ride_driver_vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  driver_profile_id uuid not null,
  vehicle_id uuid not null,
  active boolean not null default true,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ride_driver_vehicle_driver_scope_fkey
    foreign key (org_id, driver_profile_id)
    references public.ride_driver_profiles (org_id, id)
    on delete cascade,
  constraint ride_driver_vehicle_vehicle_scope_fkey
    foreign key (org_id, vehicle_id)
    references public.ride_vehicles (org_id, id)
    on delete cascade,
  constraint ride_driver_vehicle_dates_check
    check (ended_at is null or ended_at >= assigned_at)
);

create unique index if not exists ride_driver_vehicle_one_active
  on public.ride_driver_vehicle_assignments (org_id, driver_profile_id)
  where active = true;

create index if not exists ride_driver_vehicle_vehicle_idx
  on public.ride_driver_vehicle_assignments (org_id, vehicle_id, active);

create table if not exists public.ride_trips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  requester_user_id uuid,
  driver_profile_id uuid,
  vehicle_id uuid,
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
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ride_trip_driver_scope_fkey
    foreign key (org_id, driver_profile_id)
    references public.ride_driver_profiles (org_id, id)
    on delete restrict,
  constraint ride_trip_vehicle_scope_fkey
    foreign key (org_id, vehicle_id)
    references public.ride_vehicles (org_id, id)
    on delete restrict,
  constraint ride_trip_completed_dates_check
    check (completed_at is null or started_at is null or completed_at >= started_at)
);

create unique index if not exists ride_trips_org_id_id_uq
  on public.ride_trips (org_id, id);

create index if not exists ride_trips_org_status_created_idx
  on public.ride_trips (org_id, status, created_at desc);

create index if not exists ride_trips_driver_status_idx
  on public.ride_trips (org_id, driver_profile_id, status, created_at desc);

create table if not exists public.ride_trip_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  trip_id uuid not null,
  actor_user_id uuid default auth.uid(),
  event_type text not null check (length(trim(event_type)) > 0),
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ride_trip_event_trip_scope_fkey
    foreign key (org_id, trip_id)
    references public.ride_trips (org_id, id)
    on delete cascade
);

create index if not exists ride_trip_events_trip_created_idx
  on public.ride_trip_events (org_id, trip_id, created_at asc);

alter table public.ride_driver_vehicle_assignments enable row level security;
alter table public.ride_trips enable row level security;
alter table public.ride_trip_events enable row level security;

drop policy if exists ride_driver_vehicle_assignments_read on public.ride_driver_vehicle_assignments;
create policy ride_driver_vehicle_assignments_read
on public.ride_driver_vehicle_assignments
for select
to authenticated
using (
  is_org_member(org_id)
  and (
    can_manage_ride(org_id)
    or exists (
      select 1
      from public.ride_driver_profiles dp
      where dp.id = ride_driver_vehicle_assignments.driver_profile_id
        and dp.org_id = ride_driver_vehicle_assignments.org_id
        and dp.user_id = (select auth.uid())
    )
  )
);

drop policy if exists ride_trips_read on public.ride_trips;
create policy ride_trips_read
on public.ride_trips
for select
to authenticated
using (
  is_org_member(org_id)
  and (
    can_manage_ride(org_id)
    or requester_user_id = (select auth.uid())
    or exists (
      select 1
      from public.ride_driver_profiles dp
      where dp.id = ride_trips.driver_profile_id
        and dp.org_id = ride_trips.org_id
        and dp.user_id = (select auth.uid())
    )
  )
);

drop policy if exists ride_trip_events_read on public.ride_trip_events;
create policy ride_trip_events_read
on public.ride_trip_events
for select
to authenticated
using (
  exists (
    select 1
    from public.ride_trips t
    where t.id = ride_trip_events.trip_id
      and t.org_id = ride_trip_events.org_id
      and is_org_member(t.org_id)
      and (
        can_manage_ride(t.org_id)
        or t.requester_user_id = (select auth.uid())
        or exists (
          select 1
          from public.ride_driver_profiles dp
          where dp.id = t.driver_profile_id
            and dp.org_id = t.org_id
            and dp.user_id = (select auth.uid())
        )
      )
  )
);

-- New operational tables are server-controlled until the dedicated Ride operations
-- API enforces lifecycle, readiness, idempotency and audit transitions.
revoke all on public.ride_driver_vehicle_assignments from anon, authenticated;
revoke all on public.ride_trips from anon, authenticated;
revoke all on public.ride_trip_events from anon, authenticated;

comment on table public.ride_driver_vehicle_assignments is
  'Organization-scoped assignment between the existing canonical Ride driver and vehicle records.';
comment on table public.ride_trips is
  'Canonical ATLAS Ride trip source of truth. Payment, Accounting and Tax remain referenced external canonical domains.';
comment on table public.ride_trip_events is
  'Append-oriented mobility evidence for canonical Trip lifecycle transitions.';
