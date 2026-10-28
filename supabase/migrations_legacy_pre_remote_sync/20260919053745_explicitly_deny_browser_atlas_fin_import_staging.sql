-- Explicit fail-closed browser policy for temporary ATLAS Finance import staging.

drop policy if exists atlas_fin_import_deny_browser on public._atlas_fin_import_20260915;

create policy atlas_fin_import_deny_browser
  on public._atlas_fin_import_20260915
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on policy atlas_fin_import_deny_browser
  on public._atlas_fin_import_20260915 is
  'Fail-closed browser boundary: temporary ATLAS Finance import staging is service-role only.';
