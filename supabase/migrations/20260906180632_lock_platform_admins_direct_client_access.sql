drop policy if exists platform_admins_no_direct_client_access on public.atlas_platform_admins;
create policy platform_admins_no_direct_client_access
on public.atlas_platform_admins
for all
to anon, authenticated
using (false)
with check (false);
