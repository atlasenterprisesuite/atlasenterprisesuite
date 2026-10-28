insert into public.atlas_module_registry (
  org_id,
  module_code,
  enabled,
  launch_status,
  data_backend,
  config
)
select
  r.org_id,
  'voice',
  false,
  'blocked',
  'core_relational',
  jsonb_build_object(
    'backend_status', 'persistence_ready_unverified',
    'personal_voice', true,
    'generation_provider', 'not_configured',
    'apple_bridge', 'native_bridge_built_unverified',
    'storage_bucket', 'atlas-voice-samples'
  )
from public.atlas_module_registry r
where r.module_code = 'core'
  and r.enabled = true
  and r.launch_status = 'active'
on conflict (org_id, module_code) do update
set
  enabled = false,
  launch_status = 'blocked',
  data_backend = excluded.data_backend,
  config = excluded.config,
  updated_at = now();
