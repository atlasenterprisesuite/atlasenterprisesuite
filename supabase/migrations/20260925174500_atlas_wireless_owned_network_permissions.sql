-- ATLAS Wireless owned-network control permissions.
-- These permissions govern infrastructure management only. They do not grant
-- spectrum authority, carrier authorization, public-service readiness, or RF activation.

insert into public.identity_permissions (code, description)
values
  ('wireless.network.read', 'Read organization-scoped ATLAS Wireless owned-network readiness and evidence.'),
  ('wireless.network.core.manage', 'Manage ATLAS Wireless core-network configuration and readiness evidence.'),
  ('wireless.network.ran.manage', 'Manage ATLAS Wireless RAN sites and radio readiness evidence.'),
  ('wireless.network.spectrum.manage', 'Manage spectrum authorization metadata and SAS/PAL/GAA evidence.'),
  ('wireless.network.backhaul.manage', 'Manage ATLAS Wireless backhaul links and redundancy evidence.'),
  ('wireless.network.audit', 'Read ATLAS Wireless infrastructure audit evidence.'),
  ('wireless.network.admin', 'Administer ATLAS Wireless owned-network infrastructure controls.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'wireless.network.read'),
  ('owner', 'wireless.network.core.manage'),
  ('owner', 'wireless.network.ran.manage'),
  ('owner', 'wireless.network.spectrum.manage'),
  ('owner', 'wireless.network.backhaul.manage'),
  ('owner', 'wireless.network.audit'),
  ('owner', 'wireless.network.admin'),
  ('admin', 'wireless.network.read'),
  ('admin', 'wireless.network.core.manage'),
  ('admin', 'wireless.network.ran.manage'),
  ('admin', 'wireless.network.spectrum.manage'),
  ('admin', 'wireless.network.backhaul.manage'),
  ('admin', 'wireless.network.audit'),
  ('admin', 'wireless.network.admin')
on conflict do nothing;
