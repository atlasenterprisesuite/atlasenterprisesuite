insert into public.identity_permissions(code,description) values
('work.read','Read ATLAS Work objects and execution data'),
('work.write','Create and update ATLAS Work objects')
on conflict (code) do nothing;

insert into public.identity_role_permissions(role,permission_code)
select r.role,p.code
from (values ('owner'),('admin'),('manager'),('staff')) as r(role)
cross join (values ('work.read'),('work.write')) as p(code)
on conflict do nothing;

insert into public.identity_role_permissions(role,permission_code)
select r.role,'work.read'
from (values ('accountant'),('viewer')) as r(role)
on conflict do nothing;
