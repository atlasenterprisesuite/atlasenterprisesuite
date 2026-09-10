-- ATLAS People + platform permission contract v1
-- Adds only governed permission metadata/default role grants. No organization module is enabled here.

insert into public.identity_permissions(code, description) values
  ('hr.read', 'Read authorized People and HR records'),
  ('hr.write', 'Create and update governed People and HR records'),
  ('payroll.read', 'Read authorized payroll and compensation records'),
  ('payroll.write', 'Create and calculate governed payroll records'),
  ('payroll.approve', 'Approve, lock, or void governed payroll runs'),
  ('payroll.self', 'Read and submit the authenticated employee own People records'),
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
  ('spatial.read', 'View ATLAS Spatial surfaces'),
  ('forge.release.read', 'Read ATLAS release controller state and evidence'),
  ('forge.release.approve', 'Approve governed ATLAS release transitions'),
  ('forge.release.deploy', 'Execute governed ATLAS release deployment transitions'),
  ('telecom.mifi.read', 'Read authorized MiFi device state'),
  ('telecom.mifi.forwarding.write', 'Change authorized MiFi call-forwarding configuration'),
  ('revenue.purchasing.read', 'Read purchasing vendors, orders and receipts'),
  ('revenue.purchasing.manage', 'Manage purchasing vendors, orders and receipts')
on conflict (code) do update set description = excluded.description;

-- Owner/admin get the complete newly introduced governed contract.
insert into public.identity_role_permissions(role, permission_code)
select roles.role_name, permissions.permission_code
from (values ('owner'), ('admin')) roles(role_name)
cross join (values
  ('hr.read'),('hr.write'),
  ('payroll.read'),('payroll.write'),('payroll.approve'),('payroll.self'),
  ('automation.read'),('automation.create'),('automation.update'),('automation.delete'),
  ('automation.manage'),('automation.execute'),('automation.audit'),('automation.admin'),
  ('site-review.read'),('site-review.create'),('site-review.manage'),('site-review.comment'),
  ('site-review.audit'),('site-review.admin'),
  ('voice.personal.read'),('voice.personal.create'),('voice.personal.record'),
  ('voice.personal.generate'),('voice.personal.use'),('voice.personal.delete'),
  ('voice.apple.request'),('voice.apple.use'),('voice.integration.manage'),
  ('spatial.read'),
  ('forge.release.read'),('forge.release.approve'),('forge.release.deploy'),
  ('telecom.mifi.read'),('telecom.mifi.forwarding.write'),
  ('revenue.purchasing.read'),('revenue.purchasing.manage')
) permissions(permission_code)
on conflict do nothing;

-- Manager: People operations and operational platform workflows, without release/deployment approval.
insert into public.identity_role_permissions(role, permission_code) values
  ('manager','hr.read'),('manager','hr.write'),
  ('manager','payroll.read'),('manager','payroll.write'),('manager','payroll.self'),
  ('manager','automation.read'),('manager','automation.create'),('manager','automation.update'),
  ('manager','automation.manage'),('manager','automation.execute'),('manager','automation.audit'),
  ('manager','site-review.read'),('manager','site-review.create'),('manager','site-review.manage'),
  ('manager','site-review.comment'),('manager','site-review.audit'),
  ('manager','voice.personal.read'),('manager','voice.personal.create'),('manager','voice.personal.record'),
  ('manager','voice.personal.use'),('manager','voice.apple.request'),
  ('manager','spatial.read'),('manager','forge.release.read'),
  ('manager','telecom.mifi.read'),
  ('manager','revenue.purchasing.read'),('manager','revenue.purchasing.manage')
on conflict do nothing;

-- Staff: self-service and bounded operational capabilities.
insert into public.identity_role_permissions(role, permission_code) values
  ('staff','payroll.self'),
  ('staff','automation.read'),('staff','automation.execute'),
  ('staff','site-review.read'),('staff','site-review.create'),('staff','site-review.comment'),
  ('staff','voice.personal.read'),('staff','voice.personal.create'),('staff','voice.personal.record'),
  ('staff','voice.personal.use'),('staff','voice.apple.request'),
  ('staff','spatial.read'),('staff','telecom.mifi.read'),('staff','revenue.purchasing.read'),
  ('viewer','automation.read'),('viewer','site-review.read'),('viewer','spatial.read')
on conflict do nothing;

insert into public.module_registry(code, family, display_name, status) values
  ('platform.voice', 'platform', 'ATLAS Voice', 'preview'),
  ('platform.spatial', 'platform', 'ATLAS Spatial', 'preview'),
  ('revenue.purchasing', 'revenue', 'Purchasing', 'preview')
on conflict (code) do update
set family = excluded.family,
    display_name = excluded.display_name,
    status = excluded.status,
    updated_at = now();
