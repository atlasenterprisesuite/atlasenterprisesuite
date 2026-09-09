begin;

-- Pending Release Train catalog patch.
-- This file is intentionally quarantined under supabase/v2/pending and must not
-- be treated as applied production history until the Release Train replay gate passes.
insert into public.atlas_release_modules(
  module_code,
  registry_code,
  module_family,
  release_wave,
  sort_order,
  dependencies
)
values
  (
    'automations',
    'platform.automations',
    'platform-services',
    4,
    480,
    array['core','identity','rbac','audit','release-controller']
  ),
  (
    'site-review',
    'platform.site_review',
    'platform-services',
    4,
    490,
    array['core','identity','rbac','audit','release-controller']
  ),
  (
    'spatial',
    null,
    'platform-services',
    4,
    500,
    array['core','identity','rbac','audit','release-controller']
  )
on conflict (module_code) do update
set registry_code = excluded.registry_code,
    module_family = excluded.module_family,
    release_wave = excluded.release_wave,
    sort_order = excluded.sort_order,
    dependencies = excluded.dependencies;

commit;
