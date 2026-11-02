-- ATLAS 777: disposable PostgreSQL audit integrity fixtures.
-- This does not prove runtime audit persistence or delivery-time revocation.
begin;
insert into public.organizations(id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
on conflict do nothing;
insert into public.atlas_data_room_documents
  (id,organization_id,tenant_id,storage_path,created_by)
values
  ('33333333-3333-4333-8333-333333333333',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'audit/example','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01')
on conflict (id) do nothing;

-- Valid event bound to its own document organization/tenant.
insert into public.atlas_data_room_access_events
 (document_id,organization_id,tenant_id,actor_user_id,outcome)
values
 ('33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01','allow');

-- Denials for an unknown document may be logged with a NULL document ID.
insert into public.atlas_data_room_access_events
 (document_id,organization_id,tenant_id,actor_user_id,outcome)
values
 (null,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null,'deny');

do $$
begin
  begin
    insert into public.atlas_data_room_access_events
      (document_id,organization_id,tenant_id,outcome)
    values
      ('33333333-3333-4333-8333-333333333333',
       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','deny');
    raise exception 'P0: cross-tenant audit document reference accepted';
  exception
    when foreign_key_violation then null;
  end;
end $$;
rollback;
