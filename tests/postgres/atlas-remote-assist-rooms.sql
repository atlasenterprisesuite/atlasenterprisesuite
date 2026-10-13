\set ON_ERROR_STOP on
-- Isolated PostgreSQL contract test. These are deliberately fake identities.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table public.organizations (id uuid primary key);
create table public.organization_members (
  org_id uuid not null, user_id uuid not null, role text not null, status text not null,
  primary key(org_id,user_id)
);
create table public.audit_logs (
  id bigserial primary key, org_id uuid not null, user_id uuid not null,
  action text not null, table_name text not null, record_id text not null,
  old_data jsonb, new_data jsonb, created_at timestamptz default now()
);
insert into public.organizations (id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.organization_members values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','owner','active'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','admin','active'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','member','active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','44444444-4444-4444-8444-444444444444','owner','active');
\i supabase/migrations/20261013181500_atlas_remote_assist_authenticated_rooms.sql

-- Helper expects the room operation to fail for the relevant authorization/state reason.
create or replace function pg_temp.expect_denied(
  p_action text,p_org uuid,p_actor uuid,p_room uuid,p_digest text default null,
  p_expected_state text default '42501'
) returns void language plpgsql as $$
declare v_denial_state text;
begin
  begin
    perform public.atlas_remote_assist_event(p_action,p_org,p_actor,p_room,p_digest);
  exception when others then v_denial_state := SQLSTATE;
  end;
  if v_denial_state is null then
    raise exception 'P0: unexpected remote room authorization success: %',p_action;
  end if;
  if v_denial_state <> p_expected_state then
    raise exception 'P0: wrong denial reason for %, expected %, got %',p_action,p_expected_state,v_denial_state;
  end if;
end $$;

do $$
declare
  org uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  other_org uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  host uuid:='11111111-1111-4111-8111-111111111111';
  viewer uuid:='22222222-2222-4222-8222-222222222222';
  member uuid:='33333333-3333-4333-8333-333333333333';
  other_host uuid:='44444444-4444-4444-8444-444444444444';
  v_room_id uuid:='aaaaaaaa-0000-4000-8000-000000000001';
  next_id uuid:='aaaaaaaa-0000-4000-8000-000000000002';
  offer_hash text:=repeat('a',64);
  answer_hash text:=repeat('b',64);
  result jsonb;
begin
  result:=public.atlas_remote_assist_event('create',org,host,v_room_id,offer_hash);
  if result->>'status' <> 'invited' then raise exception 'P0: room not invited'; end if;
  perform pg_temp.expect_denied('join',other_org,other_host,v_room_id,offer_hash);
  perform pg_temp.expect_denied('status',org,viewer,v_room_id);
  perform pg_temp.expect_denied('join',org,member,v_room_id,offer_hash);
  perform pg_temp.expect_denied('join',org,viewer,v_room_id,repeat('c',64));
  perform pg_temp.expect_denied('join',org,host,v_room_id,offer_hash);
  result:=public.atlas_remote_assist_event('join',org,viewer,v_room_id,offer_hash);
  if result->>'status' <> 'joined' or result->>'viewer_user_id' <> viewer::text then
    raise exception 'P0: viewer not bound to room';
  end if;
  perform pg_temp.expect_denied('answer',org,viewer,v_room_id,answer_hash);
  perform pg_temp.expect_denied('approve',org,viewer,v_room_id);
  result:=public.atlas_remote_assist_event('approve',org,host,v_room_id);
  if result->>'status' <> 'approved' then raise exception 'P0: host did not approve'; end if;
  result:=public.atlas_remote_assist_event('answer',org,viewer,v_room_id,answer_hash);
  if result->>'status' <> 'answer_ready' then raise exception 'P0: verified viewer answer not saved'; end if;
  perform pg_temp.expect_denied('activate',org,host,v_room_id,offer_hash);
  perform pg_temp.expect_denied('activate',org,viewer,v_room_id,answer_hash);
  result:=public.atlas_remote_assist_event('activate',org,host,v_room_id,answer_hash);
  if result->>'status' <> 'active' then raise exception 'P0: host activation failed'; end if;
  if (select count(*) from public.audit_logs where record_id=v_room_id::text) <> 5 then
    raise exception 'P0: audit missing on creation/join/approve/answer/activate';
  end if;
  -- A participant losing org privileges immediately blocks BOTH sides.
  update public.organization_members set status='revoked' where org_id=org and user_id=viewer;
  perform pg_temp.expect_denied('status',org,host,v_room_id);
  update public.organization_members set status='active' where org_id=org and user_id=viewer;
  result:=public.atlas_remote_assist_event('stop',org,viewer,v_room_id);
  if result->>'status' <> 'revoked' then raise exception 'P0: stop did not revoke'; end if;
  perform pg_temp.expect_denied('status',org,host,v_room_id);
  perform pg_temp.expect_denied('answer',org,viewer,v_room_id,answer_hash);
  if (select count(*) from public.audit_logs where record_id=v_room_id::text) <> 6 then
    raise exception 'P0: revoke audit missing';
  end if;

  -- Audit and status mutation must be one atomic database transaction.
  perform public.atlas_remote_assist_event('create',org,host,next_id,offer_hash);
  perform public.atlas_remote_assist_event('join',org,viewer,next_id,offer_hash);
  execute 'alter table public.audit_logs add constraint remote_test_approval_denied check(action <> ''remote_assist.approve'') not valid';
  perform pg_temp.expect_denied('approve',org,host,next_id,null,'23514');
  if (select s.status from public.atlas_remote_assist_sessions s where s.id=next_id) <> 'joined' then
    raise exception 'P0: room approved even though audit insert failed';
  end if;
  execute 'alter table public.audit_logs drop constraint remote_test_approval_denied';

  raise notice 'REMOTE ASSIST P0 ISOLATION + AUDIT TESTS PASSED';
end $$;

-- Direct read or execution as an authenticated browser must fail even with a known ID.
set role authenticated;
do $$
declare v_failed boolean:=false;
begin
  begin perform count(*) from public.atlas_remote_assist_sessions;
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'P0: direct browser query leaked sessions'; end if;
end $$;
reset role;
