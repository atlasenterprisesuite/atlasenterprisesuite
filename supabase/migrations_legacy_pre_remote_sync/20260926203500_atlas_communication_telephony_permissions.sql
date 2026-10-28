insert into public.identity_permissions (code, description)
values
  ('communication.telephony.read', 'Read organization-scoped ATLAS Communication telephony readiness and call state.'),
  ('communication.telephony.call', 'Originate governed ATLAS Communication calls through a verified provider.'),
  ('communication.telephony.audit', 'Read organization-scoped telephony audit evidence.'),
  ('communication.telephony.admin', 'Administer ATLAS Communication telephony provider configuration.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'communication.telephony.read'),
  ('owner', 'communication.telephony.call'),
  ('owner', 'communication.telephony.audit'),
  ('owner', 'communication.telephony.admin'),
  ('admin', 'communication.telephony.read'),
  ('admin', 'communication.telephony.call'),
  ('admin', 'communication.telephony.audit'),
  ('admin', 'communication.telephony.admin')
on conflict do nothing;
