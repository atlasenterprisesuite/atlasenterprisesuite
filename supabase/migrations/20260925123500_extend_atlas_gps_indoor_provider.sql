-- Extend ATLAS GPS provider governance for bounded OpenStreetMap indoor lookups.
-- Public Overpass remains external-gated and non-SLA-backed.

alter table public.atlas_gps_provider_cache
  drop constraint if exists atlas_gps_provider_cache_provider_check;

alter table public.atlas_gps_provider_cache
  add constraint atlas_gps_provider_cache_provider_check
  check (provider in ('nominatim', 'osrm', 'overpass'));

insert into public.atlas_gps_provider_throttle(provider)
values ('overpass')
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
  if p_provider not in ('nominatim', 'overpass') then
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

  if v_last is null then
    return false;
  end if;

  v_interval := make_interval(secs => p_min_interval_ms::double precision / 1000.0);
  if v_last > now() - v_interval then
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
