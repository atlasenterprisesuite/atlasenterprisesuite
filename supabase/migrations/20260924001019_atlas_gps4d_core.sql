-- ATLAS GPS 4D durable user data and provider governance.
-- Saved locations are organization/user scoped. Provider cache/throttle tables are server-only.

create table if not exists public.atlas_gps_saved_places (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 240),
  category text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists atlas_gps_saved_places_org_user_idx
  on public.atlas_gps_saved_places(org_id, user_id, created_at desc);

alter table public.atlas_gps_saved_places enable row level security;

drop policy if exists atlas_gps_saved_places_read on public.atlas_gps_saved_places;
create policy atlas_gps_saved_places_read
on public.atlas_gps_saved_places
for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members om
    where om.org_id = atlas_gps_saved_places.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists atlas_gps_saved_places_insert on public.atlas_gps_saved_places;
create policy atlas_gps_saved_places_insert
on public.atlas_gps_saved_places
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members om
    where om.org_id = atlas_gps_saved_places.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists atlas_gps_saved_places_update on public.atlas_gps_saved_places;
create policy atlas_gps_saved_places_update
on public.atlas_gps_saved_places
for update to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members om
    where om.org_id = atlas_gps_saved_places.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members om
    where om.org_id = atlas_gps_saved_places.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists atlas_gps_saved_places_delete on public.atlas_gps_saved_places;
create policy atlas_gps_saved_places_delete
on public.atlas_gps_saved_places
for delete to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members om
    where om.org_id = atlas_gps_saved_places.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

grant select, insert, update, delete on public.atlas_gps_saved_places to authenticated;
revoke all on public.atlas_gps_saved_places from anon;

create table if not exists public.atlas_gps_provider_cache (
  cache_key text primary key,
  provider text not null check (provider in ('nominatim', 'osrm')),
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists atlas_gps_provider_cache_expiry_idx
  on public.atlas_gps_provider_cache(expires_at);

alter table public.atlas_gps_provider_cache enable row level security;
revoke all on public.atlas_gps_provider_cache from anon, authenticated;

create table if not exists public.atlas_gps_provider_throttle (
  provider text primary key,
  last_request_at timestamptz not null default to_timestamp(0)
);

alter table public.atlas_gps_provider_throttle enable row level security;
revoke all on public.atlas_gps_provider_throttle from anon, authenticated;

insert into public.atlas_gps_provider_throttle(provider)
values ('nominatim')
on conflict (provider) do nothing;

create or replace function public.atlas_gps_acquire_provider_slot(
  p_provider text,
  p_min_interval_ms integer default 1000
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
  v_interval interval;
begin
  if p_provider not in ('nominatim') then
    return false;
  end if;
  if p_min_interval_ms < 1000 or p_min_interval_ms > 60000 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext('atlas_gps_provider:' || p_provider));
  select last_request_at into v_last
  from public.atlas_gps_provider_throttle
  where provider = p_provider
  for update;

  v_interval := make_interval(secs => p_min_interval_ms::double precision / 1000.0);
  if v_last is not null and v_last > now() - v_interval then
    return false;
  end if;

  update public.atlas_gps_provider_throttle
  set last_request_at = now()
  where provider = p_provider;

  return true;
end;
$$;

revoke all on function public.atlas_gps_acquire_provider_slot(text, integer) from public, anon, authenticated;
grant execute on function public.atlas_gps_acquire_provider_slot(text, integer) to service_role;
