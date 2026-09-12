-- ATLAS authenticated product module registry v1
-- Adds canonical product-facing module codes used by the authenticated /app workspace.
-- This migration is additive and does not enable any module for an organization.

insert into public.module_registry(code, family, display_name, status)
values
  ('identity', 'platform', 'ATLAS Identity', 'available'),
  ('security', 'platform', 'ATLAS Security', 'preview'),
  ('analytics', 'intelligence', 'ATLAS Analytics', 'preview'),
  ('connect', 'connectivity', 'ATLAS Connect', 'preview'),
  ('documents', 'collaboration', 'ATLAS Documents', 'preview'),
  ('knowledge', 'intelligence', 'Knowledge Atlas', 'preview'),
  ('creator-studio', 'creative', 'ATLAS Studio', 'preview'),
  ('education', 'industry', 'ATLAS Education', 'preview'),
  ('global', 'global', 'ATLAS Global', 'preview'),
  ('atlas-pay', 'finance', 'ATLAS Pay & Wallet', 'preview')
on conflict (code) do update
set family = excluded.family,
    display_name = excluded.display_name,
    status = excluded.status,
    updated_at = now();

do $$
begin
  if to_regclass('public.atlas_release_modules') is null then
    return;
  end if;

  update public.atlas_release_modules release_module
  set registry_code = mapping.registry_code
  from (
    values
      ('identity'::text, 'identity'::text),
      ('security', 'security'),
      ('analytics', 'analytics'),
      ('connect', 'connect'),
      ('knowledge', 'knowledge'),
      ('creator-studio', 'creator-studio'),
      ('atlas-pay', 'atlas-pay')
  ) as mapping(module_code, registry_code)
  where release_module.module_code = mapping.module_code;

  insert into public.atlas_release_modules(
    module_code,
    registry_code,
    module_family,
    release_wave,
    sort_order,
    dependencies,
    development_status,
    development_exception,
    blocker_reason,
    activation_enabled
  )
  values
    (
      'documents',
      'documents',
      'platform-services',
      4,
      415,
      array['core','identity','rbac','audit','release-controller','drive']::text[],
      'developing',
      null,
      null,
      false
    ),
    (
      'education',
      'education',
      'industry',
      5,
      520,
      array['core','identity','rbac','audit','release-controller','knowledge']::text[],
      'developing',
      null,
      null,
      false
    ),
    (
      'global',
      'global',
      'financial-rails-specialized',
      7,
      740,
      array['core','identity','rbac','audit','release-controller']::text[],
      'developing',
      null,
      null,
      false
    )
  on conflict (module_code) do update
  set registry_code = excluded.registry_code,
      module_family = excluded.module_family,
      release_wave = excluded.release_wave,
      sort_order = excluded.sort_order,
      dependencies = excluded.dependencies;
end
$$;
