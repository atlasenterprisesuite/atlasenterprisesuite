-- ATLAS Inclusive Communication durable core
-- Reuses public.atlas_user_preferences.preferences.accessibilityCommunication.
-- Does not create a parallel accessibility-profile table.
-- Raw audio/video/image biometric payloads are intentionally excluded; media_reference stores governed pointers only.

do $$
begin
  if to_regclass('public.atlas_user_preferences') is null then
    raise exception 'atlas_user_preferences_required' using errcode = '42P01';
  end if;
end;
$$;

create table if not exists public.atlas_inclusive_communication_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null,
  purpose text not null check (char_length(trim(purpose)) between 1 and 500),
  classification text not null default 'organization'
    check (classification in ('organization','restricted','confidential','sensitive')),
  state text not null default 'draft'
    check (state in ('draft','active','completed','cancelled','blocked')),
  last_sequence bigint not null default 0 check (last_sequence >= 0),
  retention_days integer null default 30
    check (retention_days is null or retention_days between 1 and 3650),
  legal_hold boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_inclusive_communication_participants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.atlas_inclusive_communication_sessions(id) on delete cascade,
  user_id uuid,
  participant_kind text not null default 'human'
    check (participant_kind in ('human','assistant','interpreter','automation','system','external')),
  participant_role text not null default 'participant'
    check (participant_role in ('owner','participant','interpreter','observer','assistant')),
  display_label text check (display_label is null or char_length(display_label) <= 160),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  constraint atlas_inclusive_participant_identity_required
    check (user_id is not null or participant_kind in ('assistant','interpreter','automation','system','external'))
);

create unique index if not exists atlas_inclusive_participant_user_uidx
  on public.atlas_inclusive_communication_participants(session_id, user_id)
  where user_id is not null;

create table if not exists public.atlas_inclusive_communication_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.atlas_inclusive_communication_sessions(id) on delete cascade,
  client_message_id uuid not null,
  sequence bigint not null check (sequence > 0),
  actor_user_id uuid,
  actor_kind text not null default 'human'
    check (actor_kind in ('human','assistant','interpreter','automation','system','external')),
  source_modality text not null
    check (source_modality in ('text','voice','sign','braille','haptic','visual','system')),
  language_tag text check (language_tag is null or char_length(language_tag) between 2 and 64),
  sign_language_code text check (sign_language_code is null or sign_language_code ~ '^[a-z]{3}$'),
  content jsonb not null default '{}'::jsonb,
  media_reference jsonb not null default '{}'::jsonb,
  redacted_preview text check (redacted_preview is null or char_length(redacted_preview) <= 500),
  confidence numeric(5,4) not null default 1 check (confidence between 0 and 1),
  sensitive boolean not null default false,
  confirmed boolean not null default false,
  trace_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (session_id, client_message_id),
  unique (session_id, sequence),
  constraint atlas_inclusive_sign_requires_language
    check (source_modality <> 'sign' or sign_language_code is not null)
);

create table if not exists public.atlas_inclusive_communication_derivations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.atlas_inclusive_communication_sessions(id) on delete cascade,
  message_id uuid not null references public.atlas_inclusive_communication_messages(id) on delete cascade,
  derivation_kind text not null
    check (derivation_kind in (
      'transcription','translation','caption','sign_render','audio_description',
      'simplification','braille','haptic','normalization'
    )),
  provider text,
  model text,
  source_language_tag text,
  target_language_tag text,
  sign_language_code text check (sign_language_code is null or sign_language_code ~ '^[a-z]{3}$'),
  status text not null default 'not_configured'
    check (status in ('not_configured','queued','processing','ready','failed','blocked','degraded')),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  content jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.atlas_inclusive_consents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  session_id uuid references public.atlas_inclusive_communication_sessions(id) on delete cascade,
  consent_type text not null
    check (consent_type in (
      'recording','translation','human_interpreter','voice_clone',
      'accessibility_research','data_retention','assistive_device'
    )),
  status text not null default 'declined'
    check (status in ('granted','revoked','declined','expired')),
  policy_version text,
  evidence_reference text,
  granted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_inclusive_consent_timestamps
    check (
      (status <> 'granted' or granted_at is not null)
      and (status <> 'revoked' or revoked_at is not null)
    )
);

create table if not exists public.atlas_assistive_device_bindings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  device_type text not null
    check (device_type in (
      'screen_reader','braille_display','switch_control','hearing_device',
      'haptic_device','camera','microphone','other'
    )),
  platform text,
  manufacturer text,
  model text,
  firmware text,
  external_reference text,
  capability_state text not null default 'not_configured'
    check (capability_state in (
      'not_configured','api_available_unverified','verified','unavailable','degraded','blocked'
    )),
  capabilities jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  verification_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_sign_language_readiness (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  language_code text not null check (language_code ~ '^[a-z]{3}$'),
  provider text not null default 'unassigned',
  capability text not null
    check (capability in ('recognition','translation','avatar','interpreter_handoff')),
  product_status text not null default 'research_only'
    check (product_status in ('research_only','not_configured','pilot','verified','degraded','blocked')),
  linguistic_review_status text not null default 'pending'
    check (linguistic_review_status in ('pending','in_review','approved','rejected')),
  deaf_community_validated boolean not null default false,
  evidence_reference text,
  metrics jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, language_code, provider, capability),
  constraint atlas_sign_language_verified_requires_community
    check (product_status <> 'verified' or deaf_community_validated)
);

create table if not exists public.atlas_interpreter_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  communication_session_id uuid not null references public.atlas_inclusive_communication_sessions(id) on delete cascade,
  requested_by uuid not null,
  provider text,
  provider_session_id text,
  sign_language_code text check (sign_language_code is null or sign_language_code ~ '^[a-z]{3}$'),
  state text not null default 'not_configured'
    check (state in (
      'not_configured','requested','connecting','connected',
      'completed','failed','cancelled','blocked'
    )),
  consent_id uuid references public.atlas_inclusive_consents(id) on delete set null,
  requested_at timestamptz not null default now(),
  connected_at timestamptz,
  ended_at timestamptz,
  provider_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_accessibility_validation_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  scope text not null
    check (scope in (
      'automated','keyboard','screen_reader','device',
      'sign_language','deafblind','human_pilot'
    )),
  target text not null,
  platform text,
  assistive_technology text,
  language_code text,
  participant_cohort text,
  status text not null default 'pending'
    check (status in ('pass','fail','pending','blocked_external','not_configured')),
  executed_by uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_accessibility_validation_evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  validation_run_id uuid not null references public.atlas_accessibility_validation_runs(id) on delete cascade,
  evidence_type text not null
    check (evidence_type in (
      'workflow','screenshot','screen_reader_log','device_log','provider_receipt',
      'participant_result','linguistic_review','audit_reference','other'
    )),
  artifact_reference text not null,
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_inclusive_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid references public.atlas_inclusive_communication_sessions(id) on delete set null,
  actor_user_id uuid,
  action text not null check (char_length(trim(action)) between 1 and 160),
  object_type text not null check (char_length(trim(object_type)) between 1 and 120),
  object_id uuid,
  trace_id uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists atlas_inclusive_sessions_org_updated_idx
  on public.atlas_inclusive_communication_sessions(org_id, updated_at desc);
create index if not exists atlas_inclusive_participants_session_idx
  on public.atlas_inclusive_communication_participants(org_id, session_id, joined_at);
create index if not exists atlas_inclusive_participants_user_idx
  on public.atlas_inclusive_communication_participants(org_id, user_id, joined_at desc)
  where user_id is not null;
create index if not exists atlas_inclusive_messages_session_sequence_idx
  on public.atlas_inclusive_communication_messages(org_id, session_id, sequence);
create index if not exists atlas_inclusive_derivations_message_idx
  on public.atlas_inclusive_communication_derivations(org_id, message_id, created_at);
create index if not exists atlas_inclusive_consents_user_idx
  on public.atlas_inclusive_consents(org_id, user_id, consent_type, updated_at desc);
create index if not exists atlas_assistive_devices_user_idx
  on public.atlas_assistive_device_bindings(org_id, user_id, updated_at desc);
create index if not exists atlas_sign_language_readiness_org_idx
  on public.atlas_sign_language_readiness(org_id, product_status, language_code);
create index if not exists atlas_interpreter_sessions_comm_idx
  on public.atlas_interpreter_sessions(org_id, communication_session_id, requested_at desc);
create index if not exists atlas_accessibility_validation_org_idx
  on public.atlas_accessibility_validation_runs(org_id, scope, status, started_at desc);
create index if not exists atlas_accessibility_validation_evidence_run_idx
  on public.atlas_accessibility_validation_evidence(validation_run_id, created_at);
create index if not exists atlas_inclusive_audit_org_idx
  on public.atlas_inclusive_audit_events(org_id, created_at desc);

create or replace function public.atlas_inclusive_can_access_session(
  p_org_id uuid,
  p_session_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.atlas_inclusive_communication_participants p
      on p.org_id = om.org_id
     and p.user_id = p_user_id
     and p.left_at is null
    where om.org_id = p_org_id
      and om.user_id = p_user_id
      and om.status = 'active'
      and p.session_id = p_session_id
  );
$$;

create or replace function public.atlas_inclusive_create_session(
  p_org_id uuid,
  p_purpose text,
  p_classification text default 'organization'
)
returns public.atlas_inclusive_communication_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_session public.atlas_inclusive_communication_sessions;
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_classification not in ('organization','restricted','confidential','sensitive') then
    raise exception 'inclusive_classification_invalid' using errcode = '22023';
  end if;

  if char_length(trim(coalesce(p_purpose,''))) < 1 then
    raise exception 'inclusive_purpose_required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.organization_members om
    where om.org_id = p_org_id
      and om.user_id = v_user
      and om.status = 'active'
  ) then
    raise exception 'organization_membership_required' using errcode = '42501';
  end if;

  insert into public.atlas_inclusive_communication_sessions(
    org_id, created_by, purpose, classification, state, started_at
  ) values (
    p_org_id, v_user, trim(p_purpose), p_classification, 'active', now()
  )
  returning * into v_session;

  insert into public.atlas_inclusive_communication_participants(
    org_id, session_id, user_id, participant_kind, participant_role
  ) values (
    p_org_id, v_session.id, v_user, 'human', 'owner'
  );

  insert into public.atlas_inclusive_audit_events(
    org_id, session_id, actor_user_id, action, object_type, object_id
  ) values (
    p_org_id, v_session.id, v_user, 'inclusive.session.created', 'communication_session', v_session.id
  );

  return v_session;
end;
$$;

create or replace function public.atlas_inclusive_append_message(
  p_org_id uuid,
  p_session_id uuid,
  p_client_message_id uuid,
  p_source_modality text,
  p_content jsonb,
  p_language_tag text default null,
  p_sign_language_code text default null,
  p_confidence numeric default 1,
  p_sensitive boolean default false,
  p_confirmed boolean default false,
  p_media_reference jsonb default '{}'::jsonb
)
returns public.atlas_inclusive_communication_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_sequence bigint;
  v_existing public.atlas_inclusive_communication_messages;
  v_message public.atlas_inclusive_communication_messages;
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not public.atlas_inclusive_can_access_session(p_org_id, p_session_id, v_user) then
    raise exception 'inclusive_session_access_denied' using errcode = '42501';
  end if;

  if p_source_modality not in ('text','voice','sign','braille','haptic','visual','system') then
    raise exception 'inclusive_modality_invalid' using errcode = '22023';
  end if;

  if p_source_modality = 'sign' and p_sign_language_code is null then
    raise exception 'sign_language_required' using errcode = '22023';
  end if;

  if p_confidence is null or p_confidence < 0 or p_confidence > 1 then
    raise exception 'confidence_invalid' using errcode = '22023';
  end if;

  if p_confidence < 0.74 then
    raise exception 'accessibility_interpretation_blocked' using errcode = '22023';
  end if;

  if p_confidence < 0.98 and p_confirmed is not true then
    raise exception 'accessibility_confirmation_required' using errcode = '42501';
  end if;

  if p_sensitive and p_confirmed is not true then
    raise exception 'sensitive_action_confirmation_required' using errcode = '42501';
  end if;

  select * into v_existing
  from public.atlas_inclusive_communication_messages
  where session_id = p_session_id
    and client_message_id = p_client_message_id
  limit 1;

  if found then
    return v_existing;
  end if;

  update public.atlas_inclusive_communication_sessions
  set last_sequence = last_sequence + 1,
      updated_at = now()
  where id = p_session_id
    and org_id = p_org_id
    and state = 'active'
  returning last_sequence into v_sequence;

  if v_sequence is null then
    raise exception 'inclusive_session_not_active' using errcode = '55000';
  end if;

  insert into public.atlas_inclusive_communication_messages(
    org_id, session_id, client_message_id, sequence, actor_user_id,
    actor_kind, source_modality, language_tag, sign_language_code,
    content, media_reference, confidence, sensitive, confirmed
  ) values (
    p_org_id, p_session_id, p_client_message_id, v_sequence, v_user,
    'human', p_source_modality, p_language_tag, p_sign_language_code,
    coalesce(p_content, '{}'::jsonb), coalesce(p_media_reference, '{}'::jsonb),
    p_confidence, p_sensitive, p_confirmed
  )
  returning * into v_message;

  insert into public.atlas_inclusive_audit_events(
    org_id, session_id, actor_user_id, action, object_type, object_id, trace_id,
    metadata
  ) values (
    p_org_id, p_session_id, v_user, 'inclusive.message.appended',
    'communication_message', v_message.id, v_message.trace_id,
    jsonb_build_object(
      'source_modality', p_source_modality,
      'language_tag', p_language_tag,
      'sign_language_code', p_sign_language_code,
      'confidence', p_confidence,
      'sensitive', p_sensitive
    )
  );

  return v_message;
end;
$$;

create or replace function public.atlas_inclusive_purge_expired()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  with expired as (
    select s.id
    from public.atlas_inclusive_communication_sessions s
    where s.legal_hold = false
      and s.retention_days is not null
      and coalesce(s.completed_at, s.updated_at, s.created_at)
        < now() - make_interval(days => s.retention_days)
  ), deleted as (
    delete from public.atlas_inclusive_communication_sessions s
    using expired
    where s.id = expired.id
    returning s.id
  )
  select count(*) into v_deleted from deleted;

  return v_deleted;
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_job_id
    from cron.job
    where jobname = 'atlas-inclusive-communication-retention-daily'
    limit 1;

    if v_job_id is not null then
      perform cron.unschedule(v_job_id);
    end if;

    perform cron.schedule(
      'atlas-inclusive-communication-retention-daily',
      '29 4 * * *',
      'select public.atlas_inclusive_purge_expired();'
    );
  end if;
end;
$$;

alter table public.atlas_inclusive_communication_sessions enable row level security;
alter table public.atlas_inclusive_communication_participants enable row level security;
alter table public.atlas_inclusive_communication_messages enable row level security;
alter table public.atlas_inclusive_communication_derivations enable row level security;
alter table public.atlas_inclusive_consents enable row level security;
alter table public.atlas_assistive_device_bindings enable row level security;
alter table public.atlas_sign_language_readiness enable row level security;
alter table public.atlas_interpreter_sessions enable row level security;
alter table public.atlas_accessibility_validation_runs enable row level security;
alter table public.atlas_accessibility_validation_evidence enable row level security;
alter table public.atlas_inclusive_audit_events enable row level security;

create policy atlas_inclusive_sessions_read
on public.atlas_inclusive_communication_sessions
for select to authenticated
using (public.atlas_inclusive_can_access_session(org_id, id, (select auth.uid())));

create policy atlas_inclusive_participants_read
on public.atlas_inclusive_communication_participants
for select to authenticated
using (public.atlas_inclusive_can_access_session(org_id, session_id, (select auth.uid())));

create policy atlas_inclusive_messages_read
on public.atlas_inclusive_communication_messages
for select to authenticated
using (public.atlas_inclusive_can_access_session(org_id, session_id, (select auth.uid())));

create policy atlas_inclusive_derivations_read
on public.atlas_inclusive_communication_derivations
for select to authenticated
using (public.atlas_inclusive_can_access_session(org_id, session_id, (select auth.uid())));

create policy atlas_inclusive_consents_read
on public.atlas_inclusive_consents
for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.organization_members om
    where om.org_id = atlas_inclusive_consents.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

create policy atlas_inclusive_consents_insert
on public.atlas_inclusive_consents
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.organization_members om
    where om.org_id = atlas_inclusive_consents.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

create policy atlas_inclusive_consents_update
on public.atlas_inclusive_consents
for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.organization_members om
    where om.org_id = atlas_inclusive_consents.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

create policy atlas_assistive_device_bindings_read
on public.atlas_assistive_device_bindings
for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.organization_members om
    where om.org_id = atlas_assistive_device_bindings.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

create policy atlas_assistive_device_bindings_insert
on public.atlas_assistive_device_bindings
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and capability_state <> 'verified'
  and exists (
    select 1 from public.organization_members om
    where om.org_id = atlas_assistive_device_bindings.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

create policy atlas_assistive_device_bindings_update
on public.atlas_assistive_device_bindings
for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and capability_state <> 'verified'
  and exists (
    select 1 from public.organization_members om
    where om.org_id = atlas_assistive_device_bindings.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

create policy atlas_assistive_device_bindings_delete
on public.atlas_assistive_device_bindings
for delete to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.organization_members om
    where om.org_id = atlas_assistive_device_bindings.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

create policy atlas_sign_language_readiness_member_read
on public.atlas_sign_language_readiness
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = atlas_sign_language_readiness.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

create policy atlas_interpreter_sessions_read
on public.atlas_interpreter_sessions
for select to authenticated
using (
  public.atlas_inclusive_can_access_session(
    org_id, communication_session_id, (select auth.uid())
  )
);

create policy atlas_accessibility_validation_runs_member_read
on public.atlas_accessibility_validation_runs
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = atlas_accessibility_validation_runs.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

create policy atlas_accessibility_validation_evidence_member_read
on public.atlas_accessibility_validation_evidence
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = atlas_accessibility_validation_evidence.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

create policy atlas_inclusive_audit_read
on public.atlas_inclusive_audit_events
for select to authenticated
using (
  actor_user_id = (select auth.uid())
  or (
    session_id is not null
    and public.atlas_inclusive_can_access_session(org_id, session_id, (select auth.uid()))
  )
);

revoke all on public.atlas_inclusive_communication_sessions from anon, authenticated;
revoke all on public.atlas_inclusive_communication_participants from anon, authenticated;
revoke all on public.atlas_inclusive_communication_messages from anon, authenticated;
revoke all on public.atlas_inclusive_communication_derivations from anon, authenticated;
revoke all on public.atlas_inclusive_consents from anon, authenticated;
revoke all on public.atlas_assistive_device_bindings from anon, authenticated;
revoke all on public.atlas_sign_language_readiness from anon, authenticated;
revoke all on public.atlas_interpreter_sessions from anon, authenticated;
revoke all on public.atlas_accessibility_validation_runs from anon, authenticated;
revoke all on public.atlas_accessibility_validation_evidence from anon, authenticated;
revoke all on public.atlas_inclusive_audit_events from anon, authenticated;

grant select on public.atlas_inclusive_communication_sessions to authenticated;
grant select on public.atlas_inclusive_communication_participants to authenticated;
grant select on public.atlas_inclusive_communication_messages to authenticated;
grant select on public.atlas_inclusive_communication_derivations to authenticated;
grant select, insert, update on public.atlas_inclusive_consents to authenticated;
grant select, insert, update, delete on public.atlas_assistive_device_bindings to authenticated;
grant select on public.atlas_sign_language_readiness to authenticated;
grant select on public.atlas_interpreter_sessions to authenticated;
grant select on public.atlas_accessibility_validation_runs to authenticated;
grant select on public.atlas_accessibility_validation_evidence to authenticated;
grant select on public.atlas_inclusive_audit_events to authenticated;

revoke all on function public.atlas_inclusive_can_access_session(uuid, uuid, uuid) from public;
revoke all on function public.atlas_inclusive_create_session(uuid, text, text) from public;
revoke all on function public.atlas_inclusive_append_message(uuid, uuid, uuid, text, jsonb, text, text, numeric, boolean, boolean, jsonb) from public;
revoke all on function public.atlas_inclusive_purge_expired() from public;

grant execute on function public.atlas_inclusive_can_access_session(uuid, uuid, uuid) to authenticated;
grant execute on function public.atlas_inclusive_create_session(uuid, text, text) to authenticated;
grant execute on function public.atlas_inclusive_append_message(uuid, uuid, uuid, text, jsonb, text, text, numeric, boolean, boolean, jsonb) to authenticated;

-- Retention purge remains service/governance controlled. Authenticated clients cannot invoke it.
