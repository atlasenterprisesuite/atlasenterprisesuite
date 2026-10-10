insert into public.identity_permissions(code,description) values
('ride.read','Read ATLAS Ride OS driver, trip and mobility data'),
('ride.write','Create and update ATLAS Ride OS operational data'),
('ride.manage','Manage ATLAS Ride OS zones, compliance and operations')
on conflict (code) do nothing;

insert into public.identity_role_permissions(role,permission_code)
select r.role,p.code
from (values ('owner'),('admin'),('manager')) as r(role)
cross join (values ('ride.read'),('ride.write'),('ride.manage')) as p(code)
on conflict do nothing;

insert into public.identity_role_permissions(role,permission_code)
select r.role,p.code
from (values ('staff')) as r(role)
cross join (values ('ride.read'),('ride.write')) as p(code)
on conflict do nothing;

insert into public.identity_role_permissions(role,permission_code)
select r.role,'ride.read'
from (values ('accountant'),('viewer')) as r(role)
on conflict do nothing;
