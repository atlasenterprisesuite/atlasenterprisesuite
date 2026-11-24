-- Negative fixtures for ATLAS Data Room authorization, disposable PostgreSQL only.
-- Precondition: organizations table, deny-default and locked authorization migrations.
begin;
-- Use privileged fixture setup only in disposable test DB.
insert into public.organizations(id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.atlas_data_room_documents
 (id,organization_id,tenant_id,storage_path,created_by)
values ('11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a/private',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01');
insert into public.atlas_data_room_grants
 (document_id,organization_id,tenant_id,grantee_user_id)
values ('11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01');
do $$
declare
  d uuid := '11111111-1111-4111-8111-111111111111';
  a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  u uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
begin
  if not public.atlas_data_room_authorize_read_locked(d,u,a,a) then
    raise exception 'P0: expected fixture grant to authorize';
  end if;
  if public.atlas_data_room_authorize_read_locked(d,u,b,b) then
    raise exception 'P0: cross-tenant authorization';
  end if;
  if public.atlas_data_room_authorize_read_locked(d,b,a,a) then
    raise exception 'P0: unauthorized actor';
  end if;
  update public.atlas_data_room_grants set revoked_at = clock_timestamp()
  where document_id=d and grantee_user_id=u;
  if public.atlas_data_room_authorize_read_locked(d,u,a,a) then
    raise exception 'P0: revoked grant authorized';
  end if;
end $$;
rollback;
-- Concurrent interleavings require separate connections; this fixture
-- validates sequential revocation only, NOT concurrent serializability.
