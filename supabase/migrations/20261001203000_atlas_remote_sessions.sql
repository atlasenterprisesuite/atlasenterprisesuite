-- ATLAS Remote: short-lived consented remote desktop sessions.
-- Screen frames and input events are relayed ephemerally through Cloudflare Durable Objects;
-- they are never persisted in this table.

create table if not exists public.atlas_remote_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  device_id uuid not null references public.atlas_local_devices(id) on delete cascade,
  agent_id uuid not null references public.atlas_local_agents(id) on delete cascade,
  requested_by uuid not null,
  mode text not null check (mode = 'view'),
  status text not null default 'pending' check (status in ('pending','active','denied','ended','expired')),
  viewer_ticket_hash text,
  viewer_ticket_expires_at timestamptz,
  viewer_ticket_used_at timestamptz,
  consented_at timestamptz,
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists atlas_remote_sessions_org_created_idx
  on public.atlas_remote_sessions (org_id, created_at desc);
create index if not exists atlas_remote_sessions_agent_status_idx
  on public.atlas_remote_sessions (agent_id, status, expires_at);

alter table public.atlas_remote_sessions enable row level security;
revoke all on public.atlas_remote_sessions from anon, authenticated;

comment on table public.atlas_remote_sessions is
  'ATLAS Remote session authorization metadata. No screen frames, keystrokes, clipboard content, or remote payloads are persisted here.';
