-- Explicit fail-closed policies for server-only GPS provider state.

drop policy if exists atlas_gps_provider_cache_explicit_deny on public.atlas_gps_provider_cache;
create policy atlas_gps_provider_cache_explicit_deny
on public.atlas_gps_provider_cache
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists atlas_gps_provider_throttle_explicit_deny on public.atlas_gps_provider_throttle;
create policy atlas_gps_provider_throttle_explicit_deny
on public.atlas_gps_provider_throttle
for all
to anon, authenticated
using (false)
with check (false);

create index if not exists atlas_gps_saved_places_user_idx
  on public.atlas_gps_saved_places(user_id, created_at desc);
