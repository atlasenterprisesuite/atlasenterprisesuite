-- ATLAS Education Identity permission catalog.
-- Least privilege: staff/viewer receive no Education access by default.

insert into public.identity_permissions (code, description) values
  ('education.read','Read organization education courses, learners, enrollments, assessments, results, and credentials'),
  ('education.write','Manage organization education courses, learners, enrollments, assessments, results, and credentials'),
  ('education.audit','Read Education audit and compliance history')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code) values
  ('owner','education.read'),
  ('owner','education.write'),
  ('owner','education.audit'),
  ('admin','education.read'),
  ('admin','education.write'),
  ('admin','education.audit'),
  ('manager','education.read'),
  ('manager','education.write'),
  ('manager','education.audit')
on conflict (role, permission_code) do nothing;
