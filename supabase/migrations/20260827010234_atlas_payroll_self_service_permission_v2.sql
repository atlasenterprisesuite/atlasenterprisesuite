insert into public.identity_permissions (code, description) values
  ('payroll.self','Access only the authenticated identity-linked worker payroll self-service data')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code) values
  ('owner','payroll.self'),
  ('admin','payroll.self'),
  ('accountant','payroll.self'),
  ('manager','payroll.self'),
  ('staff','payroll.self'),
  ('viewer','payroll.self')
on conflict (role, permission_code) do nothing;
