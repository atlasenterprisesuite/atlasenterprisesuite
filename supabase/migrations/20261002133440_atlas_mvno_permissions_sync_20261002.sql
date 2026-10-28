-- ATLAS Wireless MVNO pilot permissions.
-- This migration registers authorization codes only. It does not create carrier
-- endpoints, provider credentials, subscriber records, or live activation paths.

insert into public.identity_permissions (code, description)
values
  ('wireless.mvno.read', 'Read organization-scoped ATLAS MVNO pilot state and verified provider evidence.'),
  ('wireless.mvno.provision', 'Request governed MVNO subscriber provisioning after provider readiness is verified.'),
  ('wireless.mvno.activate', 'Activate an MVNO subscriber only through a verified fail-closed provider adapter.'),
  ('wireless.mvno.suspend', 'Suspend an organization-scoped MVNO subscriber.'),
  ('wireless.mvno.reconnect', 'Reconnect an organization-scoped suspended MVNO subscriber after provider readiness is verified.'),
  ('wireless.mvno.revoke', 'Revoke organization-scoped MVNO subscriber service or provisioning references.'),
  ('wireless.mvno.audit', 'Read MVNO lifecycle audit evidence for the active organization.'),
  ('wireless.mvno.admin', 'Administer ATLAS MVNO provider configuration and governed lifecycle operations.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'wireless.mvno.read'),
  ('owner', 'wireless.mvno.provision'),
  ('owner', 'wireless.mvno.activate'),
  ('owner', 'wireless.mvno.suspend'),
  ('owner', 'wireless.mvno.reconnect'),
  ('owner', 'wireless.mvno.revoke'),
  ('owner', 'wireless.mvno.audit'),
  ('owner', 'wireless.mvno.admin'),
  ('admin', 'wireless.mvno.read'),
  ('admin', 'wireless.mvno.provision'),
  ('admin', 'wireless.mvno.activate'),
  ('admin', 'wireless.mvno.suspend'),
  ('admin', 'wireless.mvno.reconnect'),
  ('admin', 'wireless.mvno.revoke'),
  ('admin', 'wireless.mvno.audit'),
  ('admin', 'wireless.mvno.admin')
on conflict do nothing;
