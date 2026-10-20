insert into public.identity_permissions(code,description) values
('pos.read','Read ATLAS POS catalog, orders and receipts'),
('pos.write','Create and manage ATLAS POS catalog and sales')
on conflict (code) do nothing;

insert into public.identity_role_permissions(role,permission_code)
select r.role,p.code
from (values ('owner'),('admin'),('manager'),('staff'),('accountant')) as r(role)
cross join (values ('pos.read'),('pos.write')) as p(code)
on conflict do nothing;

insert into public.identity_role_permissions(role,permission_code)
values ('viewer','pos.read')
on conflict do nothing;
