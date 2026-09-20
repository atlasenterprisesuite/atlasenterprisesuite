-- ATLAS Voice provider lifecycle + Apple native verification evidence

alter table public.atlas_voice_profiles
  add column if not exists provider_backend text,
  add column if not exists provider_ref text,
  add column if not exists provider_state text not null default 'not_configured',
  add column if not exists provider_verified_at timestamptz,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

alter table public.atlas_voice_consents
  add column if not exists provider_kind text,
  add column if not exists provider_consent_ref text,
  add column if not exists provider_state text not null default 'not_submitted',
  add column if not exists provider_error_code text,
  add column if not exists provider_verified_at timestamptz;

alter table public.atlas_voice_generation_jobs
  add column if not exists provider_backend text;

create table if not exists public.atlas_voice_native_verifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.atlas_voice_profiles(id) on delete cascade,
  platform text not null check (platform in ('ios','macos')),
  os_version text not null,
  device_model text,
  app_build text,
  authorization_status text not null check (authorization_status in ('authorized','denied','notDetermined','unsupported')),
  personal_voice_count integer not null default 0 check (personal_voice_count >= 0),
  local_playback_verified boolean not null default false,
  verification_state text not null default 'device_reported'
    check (verification_state in ('device_reported','verified_on_supported_device','rejected')),
  capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities)='object'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata)='object' and not (metadata ?| array['audio','audio_bytes','blob','raw_audio','sample_data'])),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists atlas_voice_native_verifications_owner_idx
  on public.atlas_voice_native_verifications(org_id,owner_user_id,created_at desc);
create index if not exists atlas_voice_native_verifications_profile_idx
  on public.atlas_voice_native_verifications(profile_id,created_at desc);

alter table public.atlas_voice_native_verifications enable row level security;

drop policy if exists atlas_voice_native_verifications_read on public.atlas_voice_native_verifications;
create policy atlas_voice_native_verifications_read
on public.atlas_voice_native_verifications
for select to authenticated
using (
  owner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members om
    where om.org_id = atlas_voice_native_verifications.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

-- Native verification evidence is server-recorded after an authenticated
-- native report. Browser/direct Data API inserts remain unavailable.
revoke all on public.atlas_voice_native_verifications from anon,authenticated;
grant select on public.atlas_voice_native_verifications to authenticated;

-- Provider resources are server-governed. Direct browser clients can read
-- their own jobs through RLS but cannot fabricate provider lifecycle state.
revoke all on public.atlas_voice_generation_jobs from authenticated;
grant select on public.atlas_voice_generation_jobs to authenticated;

-- Existing profile/consent grants remain unchanged for user-owned capture.
-- Provider lifecycle columns are mutated only through the service-role Edge
-- Function and are protected from direct profile UPDATE by current grants.

update public.atlas_module_registry
set config = coalesce(config,'{}'::jsonb) || jsonb_build_object(
  'generation_provider','openai_custom_voice_configuring',
  'apple_bridge','native_verification_building'
), updated_at = now()
where module_code='voice';
