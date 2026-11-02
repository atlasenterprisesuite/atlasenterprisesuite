\set ON_ERROR_STOP on

-- Synthetic schema only. This script is run inside disposable PostgreSQL 16
-- from the CI service container. It does not use Supabase project credentials.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create function auth.uid() returns uuid
  language sql stable security invoker
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

create table public.organizations (id uuid primary key);
create table public.organization_members (
  org_id uuid not null references public.organizations(id),
  user_id uuid not null,
  status text not null,
  primary key (org_id, user_id)
);
grant select on public.organization_members to authenticated;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

-- Apply the actual recording table/policy/bucket migration from the PR.
\i supabase/migrations/20260918_creator_teleprompter_recordings.sql

-- Reproduce the dangerous default grants seen in the production catalog,
-- then apply the actual hardened migration, not a rewritten policy.
grant all privileges on table public.creator_recordings to anon;
grant all privileges on table public.creator_recordings to service_role;
\i supabase/migrations/20261028120000_creator_recordings_anon_grant_hardening.sql

insert into public.organizations (id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

insert into public.organization_members (org_id, user_id, status) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'active');

insert into public.creator_recordings (
  id, organization_id, created_by, language, storage_bucket, storage_path,
  mime_type, file_size_bytes, duration_seconds
) values
  ('10000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'es', 'atlas-creator-recordings',
   '11111111-1111-4111-8111-111111111111/a/video.webm', 'video/webm', 256, 10),
  ('20000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'en', 'atlas-creator-recordings',
   '22222222-2222-4222-8222-222222222222/b/video.webm', 'video/webm', 512, 8);

-- RLS is enforced by real Postgres SET ROLE with synthetic auth.uid() claims.
-- The membership fixture does not claim to exercise Supabase Auth or the Edge API.
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
do $a_visible_only$
declare ids text[];
begin
  select array_agg(id::text order by id) into ids from public.creator_recordings;
  if ids is distinct from array['10000000-0000-4000-8000-000000000001']::text[] then
    raise exception 'tenant_a_cross_org_visibility_failed: %', ids;
  end if;
end;
$a_visible_only$;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false);
do $b_visible_only$
declare ids text[];
begin
  select array_agg(id::text order by id) into ids from public.creator_recordings;
  if ids is distinct from array['20000000-0000-4000-8000-000000000002']::text[] then
    raise exception 'tenant_b_cross_org_visibility_failed: %', ids;
  end if;
end;
$b_visible_only$;

-- No membership: zero recordings.
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', false);
do $no_membership$
begin
  if (select count(*) from public.creator_recordings) <> 0 then
    raise exception 'nonmember_recording_read_allowed';
  end if;
end;
$no_membership$;
reset role;

-- Revocation must take effect immediately on the next SQL statement.
update public.organization_members
  set status = 'revoked'
  where org_id = '11111111-1111-4111-8111-111111111111'
    and user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
do $revoked_member$
begin
  if (select count(*) from public.creator_recordings) <> 0 then
    raise exception 'revoked_member_recording_read_allowed';
  end if;
end;
$revoked_member$;
reset role;

do $anonymous_denied$
begin
  if has_table_privilege('anon', 'public.creator_recordings', 'SELECT')
    or has_table_privilege('anon', 'public.creator_recordings', 'INSERT')
    or has_table_privilege('anon', 'public.creator_recordings', 'TRUNCATE') then
    raise exception 'anonymous_recording_grants_remain';
  end if;
  if (select public from storage.buckets where id = 'atlas-creator-recordings') is distinct from false then
    raise exception 'recording_storage_bucket_is_public';
  end if;
end;
$anonymous_denied$;

\echo PASS: real migration, tenant-A/B RLS isolation, nonmember/revocation, anon grants and private bucket
