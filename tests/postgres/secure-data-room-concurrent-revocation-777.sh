#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=postgres}"
export PGHOST PGPORT PGUSER PGDATABASE

DOC=22222222-2222-4222-8222-222222222222
ORG=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
USER_ID=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01

psql -v ON_ERROR_STOP=1 <<SQL
insert into public.organizations(id) values ('$ORG') on conflict do nothing;
insert into public.atlas_data_room_documents
 (id, organization_id, tenant_id, storage_path, created_by)
values ('$DOC', '$ORG', '$ORG', 'concurrency/private', '$USER_ID')
on conflict (id) do nothing;
insert into public.atlas_data_room_grants
 (document_id, organization_id, tenant_id, grantee_user_id)
values ('$DOC', '$ORG', '$ORG', '$USER_ID')
on conflict (document_id, grantee_user_id) do update set revoked_at = null;
SQL

# Transaction A obtains the document+grant row locks through the same
# authorization function and holds them briefly to create a deterministic race.
psql -v ON_ERROR_STOP=1 > /tmp/atlas-data-room-reader.log 2>&1 <<SQL &
begin;
select public.atlas_data_room_authorize_read_locked('$DOC','$USER_ID','$ORG','$ORG');
select pg_sleep(2);
commit;
SQL
reader_pid=$!
sleep 0.25

# Transaction B revokes the grant while A holds the authorization locks.
# It must wait for A to commit, then persist revocation.
psql -v ON_ERROR_STOP=1 <<SQL
begin;
update public.atlas_data_room_grants
set revoked_at = clock_timestamp()
where document_id = '$DOC' and grantee_user_id = '$USER_ID';
commit;
SQL
wait "$reader_pid"

# Any new authorization after the revocation commit must be denied.
psql -v ON_ERROR_STOP=1 -At <<SQL | grep -qx f
select public.atlas_data_room_authorize_read_locked('$DOC','$USER_ID','$ORG','$ORG');
SQL
