begin;

insert into public.identity_permissions (code, description)
values
  ('telecom.mifi.read', 'View ATLAS Telecom MiFi device configuration and provider state.'),
  ('telecom.mifi.forwarding.write', 'Submit and verify MiFi call-forwarding changes through an authorized adapter.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'telecom.mifi.read'),
  ('admin', 'telecom.mifi.read'),
  ('manager', 'telecom.mifi.read'),
  ('owner', 'telecom.mifi.forwarding.write'),
  ('admin', 'telecom.mifi.forwarding.write')
on conflict (role, permission_code) do nothing;

insert into public.atlas_module_registry (
  org_id,
  module_code,
  enabled,
  launch_status,
  data_backend,
  config
)
select
  organizations.id,
  'telecom',
  true,
  'blocked',
  'module_records',
  jsonb_build_object(
    'provider_state', 'not_configured',
    'required_connector', 'telecom.mifi',
    'reason', 'Authorized MiFi device adapter is not configured.'
  )
from public.organizations
on conflict (org_id, module_code) do nothing;

commit;
