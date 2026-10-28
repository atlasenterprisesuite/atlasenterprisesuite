create table if not exists public.atlas_telephony_providers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z][a-z0-9_-]{1,63}$'),
  state text not null default 'not_configured' check (state in ('not_configured','configured','verified','degraded','blocked')),
  capabilities jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  last_probe_code text,
  last_probe_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);
create table if not exists public.atlas_call_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid not null,
  provider_id uuid references public.atlas_telephony_providers(id) on delete restrict,
  provider_call_id text,
  direction text not null check (direction in ('inbound','outbound')),
  source_address text,
  destination_address text not null,
  purpose text not null check (length(trim(purpose)) > 0),
  state text not null default 'draft' check (state in ('draft','queued','dialing','ringing','connected','completed','failed','canceled','blocked')),
  consent_reference text,
  recording_enabled boolean not null default false,
  connected_at timestamptz,
  ended_at timestamptz,
  provider_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_call_recording_requires_consent check (not recording_enabled or nullif(trim(consent_reference), '') is not null)
);
create table if not exists public.atlas_call_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  call_session_id uuid not null references public.atlas_call_sessions(id) on delete cascade,
  provider_event_id text,
  event_type text not null,
  call_state text,
  provider_occurred_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);
create unique index if not exists atlas_call_events_provider_event_uidx on public.atlas_call_events (organization_id, provider_event_id) where provider_event_id is not null;
create index if not exists atlas_telephony_providers_org_state_idx on public.atlas_telephony_providers (organization_id, state, updated_at desc);
create index if not exists atlas_call_sessions_org_created_idx on public.atlas_call_sessions (organization_id, created_at desc);
create index if not exists atlas_call_events_session_received_idx on public.atlas_call_events (call_session_id, received_at desc);
alter table public.atlas_telephony_providers enable row level security;
alter table public.atlas_call_sessions enable row level security;
alter table public.atlas_call_events enable row level security;
create policy atlas_telephony_providers_member_read on public.atlas_telephony_providers for select to authenticated using (exists (select 1 from public.organization_members om where om.org_id = atlas_telephony_providers.organization_id and om.user_id = auth.uid() and om.status = 'active'));
create policy atlas_call_sessions_member_read on public.atlas_call_sessions for select to authenticated using (exists (select 1 from public.organization_members om where om.org_id = atlas_call_sessions.organization_id and om.user_id = auth.uid() and om.status = 'active'));
create policy atlas_call_events_member_read on public.atlas_call_events for select to authenticated using (exists (select 1 from public.organization_members om where om.org_id = atlas_call_events.organization_id and om.user_id = auth.uid() and om.status = 'active'));
revoke all on public.atlas_telephony_providers from authenticated;
revoke all on public.atlas_call_sessions from authenticated;
revoke all on public.atlas_call_events from authenticated;
grant select on public.atlas_telephony_providers to authenticated;
grant select on public.atlas_call_sessions to authenticated;
grant select on public.atlas_call_events to authenticated;
