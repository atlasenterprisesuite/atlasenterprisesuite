-- ATLAS Personal Voice canonical activation foundation
-- Reconciles the deployed Voice schema with source control and repairs Storage RLS.
-- Activation of the module registry remains a separate post-deploy verification step.

-- ---------------------------------------------------------------------------
-- Permission vocabulary
-- ---------------------------------------------------------------------------
insert into public.identity_permissions (code, description)
values
  ('voice.personal.read', 'Read governed Personal Voice profiles owned by or explicitly shared with the current user'),
  ('voice.personal.create', 'Create a Personal Voice profile for the current authenticated user'),
  ('voice.personal.record', 'Record and persist governed Personal Voice samples'),
  ('voice.personal.generate', 'Request provider-backed Personal Voice generation'),
  ('voice.personal.use', 'Use an authorized Personal Voice capability'),
  ('voice.personal.delete', 'Delete owned Personal Voice samples and governed state'),
  ('voice.apple.request', 'Request access to Apple Personal Voice on a supported native ATLAS client'),
  ('voice.apple.use', 'Use an authorized Apple Personal Voice on a supported native ATLAS client'),
  ('voice.integration.manage', 'Manage governed Voice provider integrations'),
  ('voice.transcript.read', 'Read governed Voice transcripts')
on conflict (code) do update set description=excluded.description;

insert into public.identity_role_permissions (role, permission_code)
select role_name, permission_code
from (
  values
    ('owner'::text,'voice.personal.read'::text),('admin'::text,'voice.personal.read'::text),
    ('owner'::text,'voice.personal.create'::text),('admin'::text,'voice.personal.create'::text),
    ('owner'::text,'voice.personal.record'::text),('admin'::text,'voice.personal.record'::text),
    ('owner'::text,'voice.personal.generate'::text),('admin'::text,'voice.personal.generate'::text),
    ('owner'::text,'voice.personal.use'::text),('admin'::text,'voice.personal.use'::text),
    ('owner'::text,'voice.personal.delete'::text),('admin'::text,'voice.personal.delete'::text),
    ('owner'::text,'voice.apple.request'::text),('admin'::text,'voice.apple.request'::text),
    ('owner'::text,'voice.apple.use'::text),('admin'::text,'voice.apple.use'::text),
    ('owner'::text,'voice.integration.manage'::text),('admin'::text,'voice.integration.manage'::text),
    ('owner'::text,'voice.transcript.read'::text),('admin'::text,'voice.transcript.read'::text)
) as v(role_name, permission_code)
on conflict (role, permission_code) do nothing;

-- ---------------------------------------------------------------------------
-- Canonical Voice tables. CREATE IF NOT EXISTS makes this migration safe for
-- the already-running atlas-core project while making the schema reproducible.
-- ---------------------------------------------------------------------------
create table if not exists public.atlas_voice_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  language text not null,
  provider_kind text not null check (provider_kind in ('atlas','apple_personal_voice')),
  status text not null default 'draft'
    check (status in ('draft','sound_check','recording','reviewing','ready_to_generate','generating','ready','suspended','deleted')),
  capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities)='object'),
  consent_version text,
  consent_accepted_at timestamptz,
  challenge_verified_at timestamptz,
  provider_ref text,
  external_cleanup_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_voice_permission_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.atlas_voice_profiles(id) on delete cascade,
  granted_user_id uuid not null references auth.users(id) on delete cascade,
  allowed_actions text[] not null default '{}'::text[]
    check (allowed_actions <@ array['read','use','transcript_read']::text[]),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(profile_id,granted_user_id)
);

create table if not exists public.atlas_voice_transcripts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.atlas_voice_profiles(id) on delete cascade,
  session_id text not null,
  source_kind text not null check (source_kind in ('provider','local_runtime')),
  source_id text not null,
  completeness text not null check (completeness in ('partial','complete')),
  content text not null,
  recording_ref text,
  source_started_at timestamptz,
  source_ended_at timestamptz,
  generated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  check (source_ended_at is null or source_started_at is null or source_ended_at >= source_started_at)
);

create table if not exists public.atlas_voice_recording_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.atlas_voice_profiles(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id),
  status text not null default 'draft'
    check (status in ('draft','sound_check','recording','reviewing','complete','cancelled')),
  current_step text not null default 'setup'
    check (current_step in ('setup','sound_check','record','review','generate')),
  accepted_sample_count integer not null default 0 check (accepted_sample_count >= 0),
  challenge_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_voice_samples (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.atlas_voice_profiles(id) on delete cascade,
  session_id uuid not null references public.atlas_voice_recording_sessions(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id),
  phrase_id text not null check (btrim(phrase_id) <> ''),
  attempt smallint not null default 1 check (attempt > 0),
  storage_path text,
  mime_type text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  byte_size bigint check (byte_size is null or byte_size >= 0),
  status text not null default 'missing' check (status in ('accepted','needs_retry','rejected','missing')),
  audio_stats jsonb not null default '{}'::jsonb check (jsonb_typeof(audio_stats)='object'),
  assessment jsonb not null default '{}'::jsonb check (jsonb_typeof(assessment)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id,phrase_id,attempt)
);

create table if not exists public.atlas_voice_consents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.atlas_voice_profiles(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id),
  consent_version text not null check (btrim(consent_version) <> ''),
  scope jsonb not null default '{}'::jsonb check (jsonb_typeof(scope)='object'),
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (revoked_at is null or revoked_at >= accepted_at)
);

create table if not exists public.atlas_voice_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.atlas_voice_profiles(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id),
  provider_kind text not null check (provider_kind in ('atlas','apple_personal_voice')),
  provider_job_ref text,
  status text not null default 'queued'
    check (status in ('queued','processing','verifying','ready','failed','cancelled','provider_unavailable','authorization_required')),
  error_code text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.atlas_voice_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.atlas_voice_profiles(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id),
  event_type text not null check (event_type ~ '^[a-z0-9][a-z0-9._-]{1,95}$'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata)='object' and not (metadata ?| array['audio','audio_bytes','blob','raw_audio','sample_data'])),
  created_at timestamptz not null default now()
);

create index if not exists atlas_voice_profiles_org_owner_idx on public.atlas_voice_profiles(org_id,owner_user_id);
create index if not exists atlas_voice_profiles_owner_idx on public.atlas_voice_profiles(owner_user_id);
create index if not exists atlas_voice_grants_org_idx on public.atlas_voice_permission_grants(org_id);
create index if not exists atlas_voice_permission_grants_user_idx on public.atlas_voice_permission_grants(granted_user_id,profile_id);
create index if not exists atlas_voice_transcripts_org_idx on public.atlas_voice_transcripts(org_id);
create index if not exists atlas_voice_transcripts_profile_generated_idx on public.atlas_voice_transcripts(profile_id,generated_at desc);
create index if not exists atlas_voice_recording_sessions_org_owner_idx on public.atlas_voice_recording_sessions(org_id,owner_user_id);
create index if not exists atlas_voice_recording_sessions_profile_idx on public.atlas_voice_recording_sessions(profile_id,created_at desc);
create index if not exists atlas_voice_samples_profile_idx on public.atlas_voice_samples(profile_id,created_at desc);
create index if not exists atlas_voice_samples_session_idx on public.atlas_voice_samples(session_id);
create index if not exists atlas_voice_consents_profile_idx on public.atlas_voice_consents(profile_id,accepted_at desc);
create index if not exists atlas_voice_generation_jobs_profile_idx on public.atlas_voice_generation_jobs(profile_id,created_at desc);
create index if not exists atlas_voice_audit_events_profile_idx on public.atlas_voice_audit_events(profile_id,created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.atlas_voice_samples'::regclass
      and conname='atlas_voice_samples_storage_path_scope_check'
  ) then
    alter table public.atlas_voice_samples
      add constraint atlas_voice_samples_storage_path_scope_check
      check (
        storage_path is null or
        storage_path like owner_user_id::text || '/' || profile_id::text || '/' || session_id::text || '/%'
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.atlas_voice_samples'::regclass
      and conname='atlas_voice_samples_accepted_storage_check'
  ) then
    alter table public.atlas_voice_samples
      add constraint atlas_voice_samples_accepted_storage_check
      check (status <> 'accepted' or storage_path is not null);
  end if;
end $$;

alter table public.atlas_voice_profiles enable row level security;
alter table public.atlas_voice_permission_grants enable row level security;
alter table public.atlas_voice_transcripts enable row level security;
alter table public.atlas_voice_recording_sessions enable row level security;
alter table public.atlas_voice_samples enable row level security;
alter table public.atlas_voice_consents enable row level security;
alter table public.atlas_voice_generation_jobs enable row level security;
alter table public.atlas_voice_audit_events enable row level security;

-- Profiles: browser creation is self-owned and starts fail-closed as a draft.
drop policy if exists atlas_voice_profiles_insert on public.atlas_voice_profiles;
create policy atlas_voice_profiles_insert on public.atlas_voice_profiles
for insert to authenticated
with check (
  owner_user_id=(select auth.uid())
  and public.has_identity_permission(org_id,'voice.personal.create')
  and status='draft'
  and provider_ref is null
  and consent_accepted_at is null
  and challenge_verified_at is null
);

drop policy if exists atlas_voice_profiles_read on public.atlas_voice_profiles;
create policy atlas_voice_profiles_read on public.atlas_voice_profiles
for select to authenticated
using (
  owner_user_id=(select auth.uid())
  or exists (
    select 1 from public.atlas_voice_permission_grants g
    where g.profile_id=atlas_voice_profiles.id
      and g.org_id=atlas_voice_profiles.org_id
      and g.granted_user_id=(select auth.uid())
      and ('read'=any(g.allowed_actions) or 'use'=any(g.allowed_actions))
  )
);

-- Profile provider/readiness fields are server-governed. No direct authenticated
-- UPDATE grant is exposed during activation.
drop policy if exists atlas_voice_profiles_update on public.atlas_voice_profiles;

drop policy if exists atlas_voice_grants_read on public.atlas_voice_permission_grants;
create policy atlas_voice_grants_read on public.atlas_voice_permission_grants
for select to authenticated
using (
  granted_user_id=(select auth.uid())
  or exists (
    select 1 from public.atlas_voice_profiles p
    where p.id=atlas_voice_permission_grants.profile_id
      and p.org_id=atlas_voice_permission_grants.org_id
      and p.owner_user_id=(select auth.uid())
  )
);

drop policy if exists atlas_voice_grants_insert on public.atlas_voice_permission_grants;
create policy atlas_voice_grants_insert on public.atlas_voice_permission_grants
for insert to authenticated
with check (
  created_by=(select auth.uid())
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id=atlas_voice_permission_grants.profile_id
      and p.org_id=atlas_voice_permission_grants.org_id
      and p.owner_user_id=(select auth.uid())
      and p.status <> 'deleted'
  )
);

drop policy if exists atlas_voice_grants_update on public.atlas_voice_permission_grants;
create policy atlas_voice_grants_update on public.atlas_voice_permission_grants
for update to authenticated
using (
  exists (
    select 1 from public.atlas_voice_profiles p
    where p.id=atlas_voice_permission_grants.profile_id
      and p.org_id=atlas_voice_permission_grants.org_id
      and p.owner_user_id=(select auth.uid())
  )
)
with check (
  created_by=(select auth.uid())
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id=atlas_voice_permission_grants.profile_id
      and p.org_id=atlas_voice_permission_grants.org_id
      and p.owner_user_id=(select auth.uid())
      and p.status <> 'deleted'
  )
);

drop policy if exists atlas_voice_grants_delete on public.atlas_voice_permission_grants;
create policy atlas_voice_grants_delete on public.atlas_voice_permission_grants
for delete to authenticated
using (
  exists (
    select 1 from public.atlas_voice_profiles p
    where p.id=atlas_voice_permission_grants.profile_id
      and p.org_id=atlas_voice_permission_grants.org_id
      and p.owner_user_id=(select auth.uid())
  )
);

drop policy if exists atlas_voice_transcripts_insert on public.atlas_voice_transcripts;
create policy atlas_voice_transcripts_insert on public.atlas_voice_transcripts
for insert to authenticated
with check (
  created_by=(select auth.uid())
  and public.has_identity_permission(org_id,'voice.personal.record')
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id=atlas_voice_transcripts.profile_id
      and p.org_id=atlas_voice_transcripts.org_id
      and p.owner_user_id=(select auth.uid())
      and p.status <> 'deleted'
  )
);

drop policy if exists atlas_voice_transcripts_read on public.atlas_voice_transcripts;
create policy atlas_voice_transcripts_read on public.atlas_voice_transcripts
for select to authenticated
using (
  public.has_identity_permission(org_id,'voice.transcript.read')
  and (
    exists (
      select 1 from public.atlas_voice_profiles p
      where p.id=atlas_voice_transcripts.profile_id
        and p.org_id=atlas_voice_transcripts.org_id
        and p.owner_user_id=(select auth.uid())
    )
    or exists (
      select 1 from public.atlas_voice_permission_grants g
      where g.profile_id=atlas_voice_transcripts.profile_id
        and g.org_id=atlas_voice_transcripts.org_id
        and g.granted_user_id=(select auth.uid())
        and 'transcript_read'=any(g.allowed_actions)
    )
  )
);

drop policy if exists atlas_voice_sessions_read on public.atlas_voice_recording_sessions;
create policy atlas_voice_sessions_read on public.atlas_voice_recording_sessions
for select to authenticated
using (
  owner_user_id=(select auth.uid())
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id=atlas_voice_recording_sessions.profile_id
      and p.org_id=atlas_voice_recording_sessions.org_id
      and p.owner_user_id=(select auth.uid())
  )
);

drop policy if exists atlas_voice_sessions_insert on public.atlas_voice_recording_sessions;
create policy atlas_voice_sessions_insert on public.atlas_voice_recording_sessions
for insert to authenticated
with check (
  owner_user_id=(select auth.uid())
  and public.has_identity_permission(org_id,'voice.personal.record')
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id=atlas_voice_recording_sessions.profile_id
      and p.org_id=atlas_voice_recording_sessions.org_id
      and p.owner_user_id=(select auth.uid())
      and p.status <> 'deleted'
  )
);

drop policy if exists atlas_voice_sessions_update on public.atlas_voice_recording_sessions;
create policy atlas_voice_sessions_update on public.atlas_voice_recording_sessions
for update to authenticated
using (
  owner_user_id=(select auth.uid())
  and public.has_identity_permission(org_id,'voice.personal.record')
)
with check (
  owner_user_id=(select auth.uid())
  and public.has_identity_permission(org_id,'voice.personal.record')
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id=atlas_voice_recording_sessions.profile_id
      and p.org_id=atlas_voice_recording_sessions.org_id
      and p.owner_user_id=(select auth.uid())
      and p.status <> 'deleted'
  )
);

drop policy if exists atlas_voice_sessions_delete on public.atlas_voice_recording_sessions;
create policy atlas_voice_sessions_delete on public.atlas_voice_recording_sessions
for delete to authenticated
using (
  owner_user_id=(select auth.uid())
  and public.has_identity_permission(org_id,'voice.personal.delete')
);

drop policy if exists atlas_voice_samples_read on public.atlas_voice_samples;
create policy atlas_voice_samples_read on public.atlas_voice_samples
for select to authenticated
using (
  owner_user_id=(select auth.uid())
  and exists (
    select 1 from public.atlas_voice_recording_sessions s
    where s.id=atlas_voice_samples.session_id
      and s.profile_id=atlas_voice_samples.profile_id
      and s.org_id=atlas_voice_samples.org_id
      and s.owner_user_id=(select auth.uid())
  )
);

drop policy if exists atlas_voice_samples_insert on public.atlas_voice_samples;
create policy atlas_voice_samples_insert on public.atlas_voice_samples
for insert to authenticated
with check (
  owner_user_id=(select auth.uid())
  and public.has_identity_permission(org_id,'voice.personal.record')
  and exists (
    select 1 from public.atlas_voice_recording_sessions s
    where s.id=atlas_voice_samples.session_id
      and s.profile_id=atlas_voice_samples.profile_id
      and s.org_id=atlas_voice_samples.org_id
      and s.owner_user_id=(select auth.uid())
      and s.status <> 'cancelled'
  )
);

drop policy if exists atlas_voice_samples_update on public.atlas_voice_samples;

drop policy if exists atlas_voice_samples_delete on public.atlas_voice_samples;
create policy atlas_voice_samples_delete on public.atlas_voice_samples
for delete to authenticated
using (
  owner_user_id=(select auth.uid())
  and public.has_identity_permission(org_id,'voice.personal.delete')
);

drop policy if exists atlas_voice_consents_read on public.atlas_voice_consents;
create policy atlas_voice_consents_read on public.atlas_voice_consents
for select to authenticated
using (
  owner_user_id=(select auth.uid())
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id=atlas_voice_consents.profile_id
      and p.org_id=atlas_voice_consents.org_id
      and p.owner_user_id=(select auth.uid())
  )
);

drop policy if exists atlas_voice_consents_insert on public.atlas_voice_consents;
create policy atlas_voice_consents_insert on public.atlas_voice_consents
for insert to authenticated
with check (
  owner_user_id=(select auth.uid())
  and public.has_identity_permission(org_id,'voice.personal.create')
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id=atlas_voice_consents.profile_id
      and p.org_id=atlas_voice_consents.org_id
      and p.owner_user_id=(select auth.uid())
      and p.status <> 'deleted'
  )
);

drop policy if exists atlas_voice_consents_update on public.atlas_voice_consents;
create policy atlas_voice_consents_update on public.atlas_voice_consents
for update to authenticated
using (owner_user_id=(select auth.uid()))
with check (
  owner_user_id=(select auth.uid())
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id=atlas_voice_consents.profile_id
      and p.org_id=atlas_voice_consents.org_id
      and p.owner_user_id=(select auth.uid())
  )
);

-- Generation state is provider/server governed. Browser clients may read their
-- own jobs but cannot fabricate queued/ready transitions directly.
drop policy if exists atlas_voice_generation_jobs_insert on public.atlas_voice_generation_jobs;
drop policy if exists atlas_voice_generation_jobs_update on public.atlas_voice_generation_jobs;
drop policy if exists atlas_voice_generation_jobs_read on public.atlas_voice_generation_jobs;
create policy atlas_voice_generation_jobs_read on public.atlas_voice_generation_jobs
for select to authenticated
using (
  owner_user_id=(select auth.uid())
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id=atlas_voice_generation_jobs.profile_id
      and p.org_id=atlas_voice_generation_jobs.org_id
      and p.owner_user_id=(select auth.uid())
  )
);

drop policy if exists atlas_voice_audit_events_read on public.atlas_voice_audit_events;
create policy atlas_voice_audit_events_read on public.atlas_voice_audit_events
for select to authenticated
using (
  exists (
    select 1 from public.atlas_voice_profiles p
    where p.id=atlas_voice_audit_events.profile_id
      and p.org_id=atlas_voice_audit_events.org_id
      and p.owner_user_id=(select auth.uid())
  )
);

drop policy if exists atlas_voice_audit_events_insert on public.atlas_voice_audit_events;
create policy atlas_voice_audit_events_insert on public.atlas_voice_audit_events
for insert to authenticated
with check (
  actor_user_id=(select auth.uid())
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id=atlas_voice_audit_events.profile_id
      and p.org_id=atlas_voice_audit_events.org_id
      and p.owner_user_id=(select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Private audio bucket. Explicitly qualify storage.objects.name inside nested
-- EXISTS subqueries so PostgreSQL cannot bind "name" to profile.name.
-- Canonical path: <auth.uid>/<profile_id>/<session_id>/<sample_id>.<ext>
-- ---------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'atlas-voice-samples','atlas-voice-samples',false,26214400,
  array['audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/x-wav','audio/aac','audio/ogg']::text[]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists atlas_voice_samples_storage_select on storage.objects;
create policy atlas_voice_samples_storage_select on storage.objects
for select to authenticated
using (
  bucket_id='atlas-voice-samples'
  and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text
  and exists (
    select 1
    from public.atlas_voice_profiles p
    join public.atlas_voice_recording_sessions s
      on s.profile_id=p.id and s.org_id=p.org_id
    where p.id=public.try_uuid((storage.foldername(storage.objects.name))[2])
      and s.id=public.try_uuid((storage.foldername(storage.objects.name))[3])
      and p.owner_user_id=(select auth.uid())
      and s.owner_user_id=(select auth.uid())
  )
);

drop policy if exists atlas_voice_samples_storage_insert on storage.objects;
create policy atlas_voice_samples_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='atlas-voice-samples'
  and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text
  and exists (
    select 1
    from public.atlas_voice_profiles p
    join public.atlas_voice_recording_sessions s
      on s.profile_id=p.id and s.org_id=p.org_id
    where p.id=public.try_uuid((storage.foldername(storage.objects.name))[2])
      and s.id=public.try_uuid((storage.foldername(storage.objects.name))[3])
      and p.owner_user_id=(select auth.uid())
      and s.owner_user_id=(select auth.uid())
      and p.status <> 'deleted'
      and s.status <> 'cancelled'
      and public.has_identity_permission(p.org_id,'voice.personal.record')
  )
);

drop policy if exists atlas_voice_samples_storage_update on storage.objects;

drop policy if exists atlas_voice_samples_storage_delete on storage.objects;
create policy atlas_voice_samples_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id='atlas-voice-samples'
  and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text
  and exists (
    select 1
    from public.atlas_voice_profiles p
    join public.atlas_voice_recording_sessions s
      on s.profile_id=p.id and s.org_id=p.org_id
    where p.id=public.try_uuid((storage.foldername(storage.objects.name))[2])
      and s.id=public.try_uuid((storage.foldername(storage.objects.name))[3])
      and p.owner_user_id=(select auth.uid())
      and s.owner_user_id=(select auth.uid())
      and public.has_identity_permission(p.org_id,'voice.personal.delete')
  )
);

-- ---------------------------------------------------------------------------
-- Data API grants. Supabase's 2026 Data API defaults require explicit grants.
-- RLS remains the row boundary; these grants only expose intended operations.
-- ---------------------------------------------------------------------------
revoke all on public.atlas_voice_profiles from anon,authenticated;
revoke all on public.atlas_voice_permission_grants from anon,authenticated;
revoke all on public.atlas_voice_transcripts from anon,authenticated;
revoke all on public.atlas_voice_recording_sessions from anon,authenticated;
revoke all on public.atlas_voice_samples from anon,authenticated;
revoke all on public.atlas_voice_consents from anon,authenticated;
revoke all on public.atlas_voice_generation_jobs from anon,authenticated;
revoke all on public.atlas_voice_audit_events from anon,authenticated;

revoke all on public.atlas_voice_profiles from anon;
revoke all on public.atlas_voice_samples from anon;

grant select, insert on public.atlas_voice_profiles to authenticated;
grant select, insert, update, delete on public.atlas_voice_permission_grants to authenticated;
grant select, insert on public.atlas_voice_transcripts to authenticated;
grant select, insert, update, delete on public.atlas_voice_recording_sessions to authenticated;
grant select, insert, delete on public.atlas_voice_samples to authenticated;
grant select, insert, update on public.atlas_voice_consents to authenticated;
grant select on public.atlas_voice_generation_jobs to authenticated;
grant select, insert on public.atlas_voice_audit_events to authenticated;

-- Keep module truth fail-closed until web + deployment verification succeeds.
insert into public.atlas_module_registry(org_id,module_code,enabled,launch_status,data_backend,config)
select
  r.org_id,
  'voice',
  false,
  'blocked',
  'core_relational',
  jsonb_build_object(
    'backend_status','persistence_ready_unverified',
    'personal_voice',true,
    'personal_voice_capture','pending_web_verification',
    'generation_provider', 'not_configured',
    'apple_bridge','native_bridge_built_unverified',
    'storage_bucket','atlas-voice-samples'
  )
from public.atlas_module_registry r
where r.module_code='core' and r.enabled=true and r.launch_status='active'
on conflict(org_id,module_code) do update set
  enabled=false,
  launch_status='blocked',
  data_backend=excluded.data_backend,
  config=excluded.config,
  updated_at=now();
