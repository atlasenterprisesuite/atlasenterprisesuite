\set ON_ERROR_STOP on

\echo 'ATLAS YouTube Direct 777 PostgreSQL 17 verification'

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end
$$;

create table public.atlas_integration_credentials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  provider text not null,
  ciphertext text not null default 'ciphertext',
  iv text not null default 'iv',
  algorithm text not null default 'AES-GCM-256',
  key_version text not null default 'v1',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.atlas_integration_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  provider text not null,
  connection_name text not null,
  auth_kind text not null default 'oauth2',
  authorized boolean not null default false,
  provider_verified boolean not null default false,
  state text not null default 'unconfigured',
  provider_account_id text,
  provider_account_label text,
  granted_scopes text[] not null default '{}',
  credential_ref uuid,
  last_verified_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  connected_by uuid,
  connected_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, connection_name)
);

create table public.atlas_social_scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  platform text not null,
  caption text not null default 'ATLAS test',
  scheduled_for timestamptz not null,
  status text not null,
  provider_connection_state text not null default 'ready',
  media_manifest jsonb not null default '[]'::jsonb,
  last_error_code text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_for > created_at)
);

create table public.atlas_oauth_states (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  provider text not null,
  nonce_hash text not null,
  requested_permissions text[] not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, nonce_hash)
);

\ir ../../supabase/migrations/20261118090000_atlas_youtube_direct_private_foundation.sql
\ir ../../supabase/migrations/20261118091500_atlas_youtube_direct_job_leases.sql

do $$
declare
  t text;
begin
  foreach t in array array[
    'atlas_youtube_drafts',
    'atlas_youtube_publication_jobs',
    'atlas_youtube_publication_events'
  ]
  loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t
        and c.relrowsecurity and c.relforcerowsecurity
    ) then
      raise exception 'P0 RLS not enabled+forced for %', t;
    end if;

    if has_table_privilege('authenticated', format('public.%I', t), 'SELECT') then
      raise exception 'P0 authenticated unexpectedly has SELECT on %', t;
    end if;
  end loop;

  if not has_table_privilege('service_role', 'public.atlas_youtube_publication_jobs', 'SELECT') then
    raise exception 'P0 service_role missing publication job SELECT';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.atlas_youtube_claim_due_job(uuid,text,text,integer)',
    'EXECUTE'
  ) then
    raise exception 'P0 authenticated unexpectedly can execute worker claim RPC';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.atlas_youtube_claim_due_job(uuid,text,text,integer)',
    'EXECUTE'
  ) then
    raise exception 'P0 service_role missing worker claim RPC';
  end if;
end
$$;

insert into public.atlas_oauth_states(
  org_id,user_id,provider,nonce_hash,requested_permissions,expires_at
) values (
  '11111111-1111-4111-8111-111111111111',
  '99999999-9999-4999-8999-999999999999',
  'google','nonce-a',array['google.youtube.upload'],now()+interval '10 minutes'
);

do $$
begin
  begin
    update public.atlas_oauth_states
    set pkce_ciphertext = 'only-one-field'
    where nonce_hash = 'nonce-a';
    raise exception 'P0 PKCE partial bundle was accepted';
  exception
    when check_violation then null;
  end;
end
$$;

insert into public.atlas_integration_credentials(
  id, org_id, provider, expires_at
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '11111111-1111-4111-8111-111111111111',
  'google',
  now() + interval '1 hour'
);

insert into public.atlas_integration_connections(
  id, org_id, provider, connection_name, authorized, provider_verified, state,
  provider_account_id, granted_scopes, credential_ref
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'google',
  'youtube:UC_ATLAS_CHANNEL_123',
  true,
  true,
  'connected',
  'UC_ATLAS_CHANNEL_123',
  array['https://www.googleapis.com/auth/youtube.upload'],
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
);

insert into public.atlas_social_scheduled_posts(
  id, org_id, platform, caption, scheduled_for, status, created_by, created_at
) values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '11111111-1111-4111-8111-111111111111',
  'youtube',
  'ATLAS test video',
  now() - interval '1 minute',
  'ready',
  '99999999-9999-4999-8999-999999999999',
  now() - interval '2 minutes'
);

insert into public.atlas_youtube_drafts(
  id, org_id, channel_id, connection_id, created_by, title, description,
  media_bucket, media_object_path, media_sha256, media_status
) values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '11111111-1111-4111-8111-111111111111',
  'UC_ATLAS_CHANNEL_123',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '99999999-9999-4999-8999-999999999999',
  'ATLAS verification video',
  'ephemeral CI only',
  'ci-media',
  'youtube/test.mp4',
  repeat('a',64),
  'ready'
);

insert into public.atlas_youtube_publication_jobs(
  id, org_id, channel_id, connection_id, draft_id, social_post_id,
  publication_key, status, scheduled_for, created_by
)
select
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '11111111-1111-4111-8111-111111111111',
  'UC_ATLAS_CHANNEL_123',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'pub-1',
  'queued',
  scheduled_for,
  '99999999-9999-4999-8999-999999999999'
from public.atlas_social_scheduled_posts
where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';

do $$
begin
  begin
    insert into public.atlas_youtube_drafts(
      org_id, channel_id, connection_id, created_by, title,
      media_bucket, media_object_path, media_sha256, media_status
    ) values (
      '22222222-2222-4222-8222-222222222222',
      'UC_ATLAS_CHANNEL_123',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '99999999-9999-4999-8999-999999999999',
      'cross tenant must fail',
      'ci-media',
      'youtube/fail.mp4',
      repeat('b',64),
      'ready'
    );
    raise exception 'P0 cross-tenant canonical connection reference was accepted';
  exception
    when foreign_key_violation then null;
  end;
end
$$;

do $$
declare
  claimed public.atlas_youtube_publication_jobs;
  second_claim public.atlas_youtube_publication_jobs;
  wrong_tenant public.atlas_youtube_publication_jobs;
  published public.atlas_youtube_publication_jobs;
begin
  claimed := public.atlas_youtube_claim_due_job(
    '11111111-1111-4111-8111-111111111111',
    'UC_ATLAS_CHANNEL_123',
    'worker-a',
    120
  );
  if claimed.id is distinct from 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid
     or claimed.status <> 'leased'
     or claimed.attempts <> 1
     or claimed.lease_owner <> 'worker-a' then
    raise exception 'P0 valid due job was not atomically leased';
  end if;

  second_claim := public.atlas_youtube_claim_due_job(
    '11111111-1111-4111-8111-111111111111',
    'UC_ATLAS_CHANNEL_123',
    'worker-b',
    120
  );
  if second_claim.id is not null then
    raise exception 'P0 same job was leased twice';
  end if;

  wrong_tenant := public.atlas_youtube_claim_due_job(
    '22222222-2222-4222-8222-222222222222',
    'UC_ATLAS_CHANNEL_123',
    'worker-x',
    120
  );
  if wrong_tenant.id is not null then
    raise exception 'P0 cross-tenant worker claimed a job';
  end if;

  begin
    perform public.atlas_youtube_confirm_published(
      '22222222-2222-4222-8222-222222222222',
      'UC_ATLAS_CHANNEL_123',
      claimed.id,
      'worker-a',
      'video-wrong',
      'ffffffff-ffff-4fff-8fff-ffffffffffff'
    );
    raise exception 'P0 cross-tenant publish confirmation was accepted';
  exception
    when sqlstate '42501' then null;
  end;

  published := public.atlas_youtube_confirm_published(
    '11111111-1111-4111-8111-111111111111',
    'UC_ATLAS_CHANNEL_123',
    claimed.id,
    'worker-a',
    'video-123',
    'ffffffff-ffff-4fff-8fff-ffffffffffff'
  );
  if published.status <> 'published' or published.provider_video_id <> 'video-123' then
    raise exception 'P0 provider-confirmed publish was not persisted correctly';
  end if;
end
$$;

insert into public.atlas_social_scheduled_posts(
  id, org_id, platform, caption, scheduled_for, status, created_by, created_at
) values (
  '12121212-1212-4121-8121-121212121212',
  '11111111-1111-4111-8111-111111111111',
  'youtube',
  'ATLAS retry test',
  now() - interval '1 minute',
  'ready',
  '99999999-9999-4999-8999-999999999999',
  now() - interval '2 minutes'
);

insert into public.atlas_youtube_drafts(
  id, org_id, channel_id, connection_id, created_by, title,
  media_bucket, media_object_path, media_sha256, media_status
) values (
  '13131313-1313-4131-8131-131313131313',
  '11111111-1111-4111-8111-111111111111',
  'UC_ATLAS_CHANNEL_123',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '99999999-9999-4999-8999-999999999999',
  'ATLAS retry verification',
  'ci-media',
  'youtube/retry.mp4',
  repeat('c',64),
  'ready'
);

insert into public.atlas_youtube_publication_jobs(
  id, org_id, channel_id, connection_id, draft_id, social_post_id,
  publication_key, status, scheduled_for, created_by
)
select
  '14141414-1414-4141-8141-141414141414',
  '11111111-1111-4111-8111-111111111111',
  'UC_ATLAS_CHANNEL_123',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '13131313-1313-4131-8131-131313131313',
  '12121212-1212-4121-8121-121212121212',
  'pub-2',
  'queued',
  scheduled_for,
  '99999999-9999-4999-8999-999999999999'
from public.atlas_social_scheduled_posts
where id='12121212-1212-4121-8121-121212121212';

do $$
declare
  claimed public.atlas_youtube_publication_jobs;
  requeued public.atlas_youtube_publication_jobs;
  quarantined integer;
begin
  claimed := public.atlas_youtube_claim_due_job(
    '11111111-1111-4111-8111-111111111111',
    'UC_ATLAS_CHANNEL_123',
    'worker-r',
    120
  );

  begin
    perform public.atlas_youtube_requeue_after_confirmed_absence(
      '11111111-1111-4111-8111-111111111111',
      'UC_ATLAS_CHANNEL_123',
      claimed.id,
      'worker-r',
      false,
      '15151515-1515-4151-8151-151515151515'
    );
    raise exception 'P0 blind retry was accepted without provider absence proof';
  exception
    when sqlstate '42501' then null;
  end;

  requeued := public.atlas_youtube_requeue_after_confirmed_absence(
    '11111111-1111-4111-8111-111111111111',
    'UC_ATLAS_CHANNEL_123',
    claimed.id,
    'worker-r',
    true,
    '15151515-1515-4151-8151-151515151515'
  );
  if requeued.status <> 'queued' or requeued.lease_owner is not null then
    raise exception 'P0 confirmed-absence retry did not return job safely to queue';
  end if;

  claimed := public.atlas_youtube_claim_due_job(
    '11111111-1111-4111-8111-111111111111',
    'UC_ATLAS_CHANNEL_123',
    'worker-expire',
    120
  );
  update public.atlas_youtube_publication_jobs
  set lease_expires_at = now() - interval '1 second'
  where id = claimed.id;

  begin
    perform public.atlas_youtube_confirm_published(
      '11111111-1111-4111-8111-111111111111',
      'UC_ATLAS_CHANNEL_123',
      claimed.id,
      'worker-expire',
      'video-stale',
      '16161616-1616-4161-8161-161616161616'
    );
    raise exception 'P0 expired worker was permitted to confirm publication';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform public.atlas_youtube_requeue_after_confirmed_absence(
      '11111111-1111-4111-8111-111111111111',
      'UC_ATLAS_CHANNEL_123',
      claimed.id,
      'worker-expire',
      true,
      '17171717-1717-4171-8171-171717171717'
    );
    raise exception 'P0 expired worker was permitted to requeue';
  exception
    when sqlstate '42501' then null;
  end;

  quarantined := public.atlas_youtube_quarantine_expired_leases();
  if quarantined <> 1 then
    raise exception 'P0 expected exactly one expired lease quarantine, got %', quarantined;
  end if;
  if not exists (
    select 1 from public.atlas_youtube_publication_jobs
    where id = claimed.id and status = 'blocked'
      and lease_owner is null and lease_expires_at is null
  ) then
    raise exception 'P0 expired lease was not fail-closed to blocked';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from public.atlas_youtube_publication_events
    where event_type = 'provider_publish_confirmed'
  ) then
    raise exception 'P0 publication confirmation evidence event missing';
  end if;

  if not exists (
    select 1 from public.atlas_youtube_publication_events
    where event_type = 'lease_expired_blocked'
      and detail @> '{"requires_reconciliation": true}'::jsonb
  ) then
    raise exception 'P0 expired-lease reconciliation evidence missing';
  end if;
end
$$;

\echo 'ATLAS YouTube Direct PostgreSQL verification PASS'
