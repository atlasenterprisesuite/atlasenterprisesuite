begin;

-- Pending platform permission contract. This file is intentionally quarantined
-- under supabase/v2/pending and is not applied production history.
insert into public.identity_permissions(code, description) values
  ('automation.read', 'Read ATLAS automation definitions and execution state'),
  ('automation.create', 'Create ATLAS automation definitions'),
  ('automation.update', 'Update ATLAS automation definitions'),
  ('automation.delete', 'Delete ATLAS automation definitions'),
  ('automation.manage', 'Manage ATLAS automation configuration'),
  ('automation.execute', 'Execute authorized ATLAS automations'),
  ('automation.audit', 'Read ATLAS automation audit evidence'),
  ('automation.admin', 'Administer ATLAS Automations'),
  ('site-review.read', 'Read ATLAS Site Review sessions and findings'),
  ('site-review.create', 'Create ATLAS Site Review sessions and issues'),
  ('site-review.manage', 'Manage ATLAS Site Review workflows'),
  ('site-review.comment', 'Comment on ATLAS Site Review issues'),
  ('site-review.audit', 'Read ATLAS Site Review audit evidence'),
  ('site-review.admin', 'Administer ATLAS Site Review'),
  ('voice.personal.read', 'Read the authenticated user Personal Voice state'),
  ('voice.personal.create', 'Create a user-owned ATLAS Personal Voice enrollment'),
  ('voice.personal.record', 'Record samples for a user-owned ATLAS Personal Voice'),
  ('voice.personal.generate', 'Request generation through a verified ATLAS Voice provider'),
  ('voice.personal.use', 'Use an authorized ATLAS Personal Voice capability'),
  ('voice.personal.delete', 'Delete a user-owned ATLAS Personal Voice profile'),
  ('voice.apple.request', 'Request the ATLAS iOS Apple Personal Voice bridge'),
  ('voice.apple.use', 'Use an authorized Apple Personal Voice bridge capability'),
  ('voice.integration.manage', 'Manage ATLAS Voice provider integrations'),
  ('spatial.read', 'View ATLAS Spatial surfaces')
on conflict (code) do update set description = excluded.description;

-- Owner/admin: broad governed platform administration.
insert into public.identity_role_permissions(role, permission_code)
select role_name, permission_code
from (values ('owner'), ('admin')) roles(role_name)
cross join (values
  ('automation.read'),('automation.create'),('automation.update'),('automation.delete'),
  ('automation.manage'),('automation.execute'),('automation.audit'),('automation.admin'),
  ('site-review.read'),('site-review.create'),('site-review.manage'),('site-review.comment'),
  ('site-review.audit'),('site-review.admin'),
  ('voice.personal.read'),('voice.personal.create'),('voice.personal.record'),
  ('voice.personal.generate'),('voice.personal.use'),('voice.personal.delete'),
  ('voice.apple.request'),('voice.apple.use'),('voice.integration.manage'),
  ('spatial.read')
) permissions(permission_code)
on conflict do nothing;

-- Manager: operate workflows without provider administration or destructive Voice controls.
insert into public.identity_role_permissions(role, permission_code) values
  ('manager','automation.read'),
  ('manager','automation.create'),
  ('manager','automation.update'),
  ('manager','automation.manage'),
  ('manager','automation.execute'),
  ('manager','automation.audit'),
  ('manager','site-review.read'),
  ('manager','site-review.create'),
  ('manager','site-review.manage'),
  ('manager','site-review.comment'),
  ('manager','site-review.audit'),
  ('manager','voice.personal.read'),
  ('manager','voice.personal.create'),
  ('manager','voice.personal.record'),
  ('manager','voice.personal.use'),
  ('manager','voice.apple.request'),
  ('manager','spatial.read')
on conflict do nothing;

-- Staff: read/execute operational workflows and self-owned voice capabilities.
insert into public.identity_role_permissions(role, permission_code) values
  ('staff','automation.read'),
  ('staff','automation.execute'),
  ('staff','site-review.read'),
  ('staff','site-review.create'),
  ('staff','site-review.comment'),
  ('staff','voice.personal.read'),
  ('staff','voice.personal.create'),
  ('staff','voice.personal.record'),
  ('staff','voice.personal.use'),
  ('staff','voice.apple.request'),
  ('staff','spatial.read'),
  ('viewer','automation.read'),
  ('viewer','site-review.read'),
  ('viewer','spatial.read')
on conflict do nothing;

insert into public.module_registry(code, family, display_name, status) values
  ('platform.voice', 'platform', 'ATLAS Voice', 'preview'),
  ('platform.spatial', 'platform', 'ATLAS Spatial', 'preview')
on conflict (code) do update
set family = excluded.family,
    display_name = excluded.display_name,
    status = excluded.status;

commit;
