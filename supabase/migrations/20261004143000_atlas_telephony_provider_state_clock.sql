alter table public.atlas_call_sessions
  add column if not exists provider_state_at timestamptz,
  add column if not exists provider_state_event_id text;

create index if not exists atlas_call_sessions_org_provider_state_idx
  on public.atlas_call_sessions (organization_id, provider_state_at desc);
