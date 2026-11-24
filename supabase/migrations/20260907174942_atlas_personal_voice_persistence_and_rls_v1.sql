-- ATLAS Personal Voice persistence + RLS hardening v1
-- Extends the existing ATLAS Voice schema; does not mark the module live.

-- ---------------------------------------------------------------------------
-- 1) Repair existing ATLAS Voice RLS policies
-- ---------------------------------------------------------------------------

drop policy if exists atlas_voice_profiles_read on public.atlas_voice_profiles;
create policy atlas_voice_profiles_read
on public.atlas_voice_profiles
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  or exists (
    select 1
    from public.atlas_voice_permission_grants g
    where g.profile_id = atlas_voice_profiles.id
      and g.org_id = atlas_voice_profiles.org_id
      and g.granted_user_id = (select auth.uid())
      and (
        'read' = any(g.allowed_actions)
        or 'use' = any(g.allowed_actions)
      )
  )
);

drop policy if exists atlas_voice_grants_insert on public.atlas_voice_permission_grants;
create policy atlas_voice_grants_insert
on public.atlas_voice_permission_grants
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.atlas_voice_profiles p
    where p.id = atlas_voice_permission_grants.profile_id
      and p.org_id = atlas_voice_permission_grants.org_id
      and p.owner_user_id = (select auth.uid())
      and p.status <> 'deleted'
  )
);

drop policy if exists atlas_voice_transcripts_insert on public.atlas_voice_transcripts;
create policy atlas_voice_transcripts_insert
on public.atlas_voice_transcripts
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_identity_permission(org_id, 'voice.personal.record')
  and exists (
    select 1
    from public.atlas_voice_profiles p
    where p.id = atlas_voice_transcripts.profile_id
      and p.org_id = atlas_voice_transcripts.org_id
      and p.owner_user_id = (select auth.uid())
      and p.status <> 'deleted'
  )
);

drop policy if exists atlas_voice_transcripts_read on public.atlas_voice_transcripts;
create policy atlas_voice_transcripts_read
on public.atlas_voice_transcripts
for select
to authenticated
using (
  public.has_identity_permission(org_id, 'voice.transcript.read')
  and (
    exists (
      select 1
      from public.atlas_voice_profiles p
      where p.id = atlas_voice_transcripts.profile_id
        and p.org_id = atlas_voice_transcripts.org_id
        and p.owner_user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.atlas_voice_permission_grants g
      where g.profile_id = atlas_voice_transcripts.profile_id
        and g.org_id = atlas_voice_transcripts.org_id
        and g.granted_user_id = (select auth.uid())
        and 'transcript_read' = any(g.allowed_actions)
    )
  )
);

-- ---------------------------------------------------------------------------
-- 2) Add missing Apple Personal Voice permissions to the existing identity
--    permission registry and default owner/admin role mappings.
-- ---------------------------------------------------------------------------

insert into public.identity_permissions (code, description)
values
  ('voice.apple.request', 'Request access to Apple Personal Voice on a supported native ATLAS client'),
  ('voice.apple.use', 'Use an authorized Apple Personal Voice on a supported native ATLAS client')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
select role_name, permission_code
from (
  values
    ('owner'::text, 'voice.apple.request'::text),
    ('admin'::text, 'voice.apple.request'::text),
    ('owner'::text, 'voice.apple.use'::text),
    ('admin'::text, 'voice.apple.use'::text)
) as v(role_name, permission_code)
on conflict (role, permission_code) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Personal Voice persistence entities
-- ---------------------------------------------------------------------------

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

comment on table public.atlas_voice_recording_sessions is
  'ATLAS Personal Voice resumable recording-session metadata. Audio bytes are not stored in this table.';

create index if not exists atlas_voice_recording_sessions_org_owner_idx
  on public.atlas_voice_recording_sessions (org_id, owner_user_id);
create index if not exists atlas_voice_recording_sessions_profile_idx
  on public.atlas_voice_recording_sessions (profile_id, created_at desc);
create index if not exists atlas_voice_recording_sessions_owner_idx
  on public.atlas_voice_recording_sessions (owner_user_id);

alter table public.atlas_voice_recording_sessions enable row level security;

drop policy if exists atlas_voice_sessions_read on public.atlas_voice_recording_sessions;
create policy atlas_voice_sessions_read
on public.atlas_voice_recording_sessions
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = atlas_voice_recording_sessions.profile_id
      and p.org_id = atlas_voice_recording_sessions.org_id
      and p.owner_user_id = (select auth.uid())
  )
);

drop policy if exists atlas_voice_sessions_insert on public.atlas_voice_recording_sessions;
create policy atlas_voice_sessions_insert
on public.atlas_voice_recording_sessions
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and public.has_identity_permission(org_id, 'voice.personal.record')
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = atlas_voice_recording_sessions.profile_id
      and p.org_id = atlas_voice_recording_sessions.org_id
      and p.owner_user_id = (select auth.uid())
      and p.status <> 'deleted'
  )
);

drop policy if exists atlas_voice_sessions_update on public.atlas_voice_recording_sessions;
create policy atlas_voice_sessions_update
on public.atlas_voice_recording_sessions
for update
to authenticated
using (
  owner_user_id = (select auth.uid())
  and public.has_identity_permission(org_id, 'voice.personal.record')
)
with check (
  owner_user_id = (select auth.uid())
  and public.has_identity_permission(org_id, 'voice.personal.record')
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = atlas_voice_recording_sessions.profile_id
      and p.org_id = atlas_voice_recording_sessions.org_id
      and p.owner_user_id = (select auth.uid())
      and p.status <> 'deleted'
  )
);

drop policy if exists atlas_voice_sessions_delete on public.atlas_voice_recording_sessions;
create policy atlas_voice_sessions_delete
on public.atlas_voice_recording_sessions
for delete
to authenticated
using (
  owner_user_id = (select auth.uid())
  and public.has_identity_permission(org_id, 'voice.personal.delete')
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
  status text not null default 'missing'
    check (status in ('accepted','needs_retry','rejected','missing')),
  audio_stats jsonb not null default '{}'::jsonb
    check (jsonb_typeof(audio_stats) = 'object'),
  assessment jsonb not null default '{}'::jsonb
    check (jsonb_typeof(assessment) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, phrase_id, attempt)
);

comment on table public.atlas_voice_samples is
  'ATLAS Personal Voice sample metadata. Raw audio, when retained, lives only in the private atlas-voice-samples Storage bucket.';

create index if not exists atlas_voice_samples_org_idx
  on public.atlas_voice_samples (org_id);
create index if not exists atlas_voice_samples_profile_idx
  on public.atlas_voice_samples (profile_id, created_at desc);
create index if not exists atlas_voice_samples_session_idx
  on public.atlas_voice_samples (session_id);
create index if not exists atlas_voice_samples_owner_idx
  on public.atlas_voice_samples (owner_user_id);

alter table public.atlas_voice_samples enable row level security;

drop policy if exists atlas_voice_samples_read on public.atlas_voice_samples;
create policy atlas_voice_samples_read
on public.atlas_voice_samples
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  and exists (
    select 1 from public.atlas_voice_recording_sessions s
    where s.id = atlas_voice_samples.session_id
      and s.profile_id = atlas_voice_samples.profile_id
      and s.org_id = atlas_voice_samples.org_id
      and s.owner_user_id = (select auth.uid())
  )
);

drop policy if exists atlas_voice_samples_insert on public.atlas_voice_samples;
create policy atlas_voice_samples_insert
on public.atlas_voice_samples
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and public.has_identity_permission(org_id, 'voice.personal.record')
  and exists (
    select 1 from public.atlas_voice_recording_sessions s
    where s.id = atlas_voice_samples.session_id
      and s.profile_id = atlas_voice_samples.profile_id
      and s.org_id = atlas_voice_samples.org_id
      and s.owner_user_id = (select auth.uid())
      and s.status <> 'cancelled'
  )
);

drop policy if exists atlas_voice_samples_update on public.atlas_voice_samples;
create policy atlas_voice_samples_update
on public.atlas_voice_samples
for update
to authenticated
using (
  owner_user_id = (select auth.uid())
  and public.has_identity_permission(org_id, 'voice.personal.record')
)
with check (
  owner_user_id = (select auth.uid())
  and public.has_identity_permission(org_id, 'voice.personal.record')
  and exists (
    select 1 from public.atlas_voice_recording_sessions s
    where s.id = atlas_voice_samples.session_id
      and s.profile_id = atlas_voice_samples.profile_id
      and s.org_id = atlas_voice_samples.org_id
      and s.owner_user_id = (select auth.uid())
      and s.status <> 'cancelled'
  )
);

drop policy if exists atlas_voice_samples_delete on public.atlas_voice_samples;
create policy atlas_voice_samples_delete
on public.atlas_voice_samples
for delete
to authenticated
using (
  owner_user_id = (select auth.uid())
  and public.has_identity_permission(org_id, 'voice.personal.delete')
);

create table if not exists public.atlas_voice_consents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.atlas_voice_profiles(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id),
  consent_version text not null check (btrim(consent_version) <> ''),
  scope jsonb not null default '{}'::jsonb check (jsonb_typeof(scope) = 'object'),
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (revoked_at is null or revoked_at >= accepted_at)
);

comment on table public.atlas_voice_consents is
  'Versioned consent records for Personal Voice ownership and usage scope. Rows are retained as governance evidence.';

create index if not exists atlas_voice_consents_org_idx
  on public.atlas_voice_consents (org_id);
create index if not exists atlas_voice_consents_profile_idx
  on public.atlas_voice_consents (profile_id, accepted_at desc);
create index if not exists atlas_voice_consents_owner_idx
  on public.atlas_voice_consents (owner_user_id);

alter table public.atlas_voice_consents enable row level security;

drop policy if exists atlas_voice_consents_read on public.atlas_voice_consents;
create policy atlas_voice_consents_read
on public.atlas_voice_consents
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = atlas_voice_consents.profile_id
      and p.org_id = atlas_voice_consents.org_id
      and p.owner_user_id = (select auth.uid())
  )
);

drop policy if exists atlas_voice_consents_insert on public.atlas_voice_consents;
create policy atlas_voice_consents_insert
on public.atlas_voice_consents
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and public.has_identity_permission(org_id, 'voice.personal.create')
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = atlas_voice_consents.profile_id
      and p.org_id = atlas_voice_consents.org_id
      and p.owner_user_id = (select auth.uid())
      and p.status <> 'deleted'
  )
);

drop policy if exists atlas_voice_consents_update on public.atlas_voice_consents;
create policy atlas_voice_consents_update
on public.atlas_voice_consents
for update
to authenticated
using (
  owner_user_id = (select auth.uid())
)
with check (
  owner_user_id = (select auth.uid())
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = atlas_voice_consents.profile_id
      and p.org_id = atlas_voice_consents.org_id
      and p.owner_user_id = (select auth.uid())
  )
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
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.atlas_voice_generation_jobs is
  'Provider-backed Personal Voice generation lifecycle. No row may imply readiness unless a real provider reports it.';

create index if not exists atlas_voice_generation_jobs_org_idx
  on public.atlas_voice_generation_jobs (org_id);
create index if not exists atlas_voice_generation_jobs_profile_idx
  on public.atlas_voice_generation_jobs (profile_id, created_at desc);
create index if not exists atlas_voice_generation_jobs_owner_idx
  on public.atlas_voice_generation_jobs (owner_user_id);

alter table public.atlas_voice_generation_jobs enable row level security;

drop policy if exists atlas_voice_generation_jobs_read on public.atlas_voice_generation_jobs;
create policy atlas_voice_generation_jobs_read
on public.atlas_voice_generation_jobs
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = atlas_voice_generation_jobs.profile_id
      and p.org_id = atlas_voice_generation_jobs.org_id
      and p.owner_user_id = (select auth.uid())
  )
);

drop policy if exists atlas_voice_generation_jobs_insert on public.atlas_voice_generation_jobs;
create policy atlas_voice_generation_jobs_insert
on public.atlas_voice_generation_jobs
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and public.has_identity_permission(org_id, 'voice.personal.generate')
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = atlas_voice_generation_jobs.profile_id
      and p.org_id = atlas_voice_generation_jobs.org_id
      and p.owner_user_id = (select auth.uid())
      and p.provider_kind = atlas_voice_generation_jobs.provider_kind
      and p.status <> 'deleted'
  )
);

drop policy if exists atlas_voice_generation_jobs_update on public.atlas_voice_generation_jobs;
create policy atlas_voice_generation_jobs_update
on public.atlas_voice_generation_jobs
for update
to authenticated
using (
  owner_user_id = (select auth.uid())
  and public.has_identity_permission(org_id, 'voice.personal.generate')
)
with check (
  owner_user_id = (select auth.uid())
  and public.has_identity_permission(org_id, 'voice.personal.generate')
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = atlas_voice_generation_jobs.profile_id
      and p.org_id = atlas_voice_generation_jobs.org_id
      and p.owner_user_id = (select auth.uid())
      and p.provider_kind = atlas_voice_generation_jobs.provider_kind
  )
);

create table if not exists public.atlas_voice_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.atlas_voice_profiles(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id),
  event_type text not null check (event_type ~ '^[a-z0-9][a-z0-9._-]{1,95}$'),
  metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(metadata) = 'object'
      and not (metadata ?| array['audio','audio_bytes','blob','raw_audio','sample_data'])
    ),
  created_at timestamptz not null default now()
);

comment on table public.atlas_voice_audit_events is
  'Metadata-only ATLAS Personal Voice audit trail. Raw audio and sample payloads are prohibited by constraint.';

create index if not exists atlas_voice_audit_events_org_idx
  on public.atlas_voice_audit_events (org_id);
create index if not exists atlas_voice_audit_events_profile_idx
  on public.atlas_voice_audit_events (profile_id, created_at desc);
create index if not exists atlas_voice_audit_events_actor_idx
  on public.atlas_voice_audit_events (actor_user_id);

alter table public.atlas_voice_audit_events enable row level security;

drop policy if exists atlas_voice_audit_events_read on public.atlas_voice_audit_events;
create policy atlas_voice_audit_events_read
on public.atlas_voice_audit_events
for select
to authenticated
using (
  exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = atlas_voice_audit_events.profile_id
      and p.org_id = atlas_voice_audit_events.org_id
      and p.owner_user_id = (select auth.uid())
  )
);

drop policy if exists atlas_voice_audit_events_insert on public.atlas_voice_audit_events;
create policy atlas_voice_audit_events_insert
on public.atlas_voice_audit_events
for insert
to authenticated
with check (
  actor_user_id = (select auth.uid())
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = atlas_voice_audit_events.profile_id
      and p.org_id = atlas_voice_audit_events.org_id
      and p.owner_user_id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- 4) Private Storage bucket for optional retained training samples
--    Path convention: <owner_user_id>/<profile_id>/<object-name>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'atlas-voice-samples',
  'atlas-voice-samples',
  false,
  26214400,
  array['audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/x-wav','audio/aac','audio/ogg']::text[]
)
on conflict (id) do nothing;

drop policy if exists atlas_voice_samples_storage_select on storage.objects;
create policy atlas_voice_samples_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'atlas-voice-samples'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = public.try_uuid((storage.foldername(name))[2])
      and p.owner_user_id = (select auth.uid())
  )
);

drop policy if exists atlas_voice_samples_storage_insert on storage.objects;
create policy atlas_voice_samples_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'atlas-voice-samples'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = public.try_uuid((storage.foldername(name))[2])
      and p.owner_user_id = (select auth.uid())
      and p.status <> 'deleted'
      and public.has_identity_permission(p.org_id, 'voice.personal.record')
  )
);

drop policy if exists atlas_voice_samples_storage_update on storage.objects;
create policy atlas_voice_samples_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'atlas-voice-samples'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = public.try_uuid((storage.foldername(name))[2])
      and p.owner_user_id = (select auth.uid())
      and public.has_identity_permission(p.org_id, 'voice.personal.record')
  )
)
with check (
  bucket_id = 'atlas-voice-samples'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = public.try_uuid((storage.foldername(name))[2])
      and p.owner_user_id = (select auth.uid())
      and p.status <> 'deleted'
      and public.has_identity_permission(p.org_id, 'voice.personal.record')
  )
);

drop policy if exists atlas_voice_samples_storage_delete on storage.objects;
create policy atlas_voice_samples_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'atlas-voice-samples'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.atlas_voice_profiles p
    where p.id = public.try_uuid((storage.foldername(name))[2])
      and p.owner_user_id = (select auth.uid())
      and public.has_identity_permission(p.org_id, 'voice.personal.delete')
  )
);

-- ---------------------------------------------------------------------------
-- 5) Data API privileges (RLS still governs rows)
-- ---------------------------------------------------------------------------

grant select, insert, update on public.atlas_voice_profiles to authenticated;
grant select, insert, update, delete on public.atlas_voice_permission_grants to authenticated;
grant select, insert on public.atlas_voice_transcripts to authenticated;
grant select, insert, update, delete on public.atlas_voice_recording_sessions to authenticated;
grant select, insert, update, delete on public.atlas_voice_samples to authenticated;
grant select, insert, update on public.atlas_voice_consents to authenticated;
grant select, insert, update on public.atlas_voice_generation_jobs to authenticated;
grant select, insert on public.atlas_voice_audit_events to authenticated;
