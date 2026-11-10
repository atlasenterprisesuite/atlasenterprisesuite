insert into public.identity_permissions (code, description) values
  ('payroll.read','Read organization payroll data'),
  ('payroll.write','Create or update payroll configuration, workers, time, deductions, PTO, contractors, and draft runs'),
  ('payroll.approve','Approve payroll runs after validation'),
  ('payroll.tax','Manage payroll tax configuration and year-end preparation'),
  ('payroll.audit','Read payroll audit and reconciliation data')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code) values
  ('owner','payroll.read'),('owner','payroll.write'),('owner','payroll.approve'),('owner','payroll.tax'),('owner','payroll.audit'),
  ('admin','payroll.read'),('admin','payroll.write'),('admin','payroll.approve'),('admin','payroll.tax'),('admin','payroll.audit'),
  ('accountant','payroll.read'),('accountant','payroll.write'),('accountant','payroll.tax'),('accountant','payroll.audit'),
  ('manager','payroll.read'),('manager','payroll.write'),('manager','payroll.approve')
on conflict (role, permission_code) do nothing;
