-- ATLAS Device OS · Local Control Plane
-- Governs Local Agent identity, short-lived sessions, explicit device inventory,
-- command references and append-only safe telemetry. No raw provider/device secrets.

insert into public.identity_permissions (code, description)
values
  ('device.agent.read', 'Read organization-scoped ATLAS Local Agent and device state.'),
  ('device.agent.use', 'Queue governed low/medium-risk actions for registered local devices.'),
  ('device.agent.admin', 'Enroll/revoke ATLAS Local Agents and administer local device control-plane state.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'device.agent.read'),
  ('owner', 'device.agent.use'),
  ('owner', 'device.agent.admin'),
  ('admin', 'device.agent.read'),
  ('admin', 'device.agent.use'),
  ('admin', 'device.agent.admin')
on conflict do nothing;

create table if not exists public.atlas_local_agents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status text not null default 'online' check (status in ('online','offline','revoked')),
  platform text not null default 'unknown' check (char_length(platform) between 1 and 120),
  agent_version text not null default 'unknown' check (char_length(agent_version) between 1 and 80),
  capabilities text[] not null default '{}',
  modules text[] not null default '{}',
  public_key_fingerprint text,
  last_seen_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_local_agents_org_name_key unique (org_id, name),
  constraint atlas_local_agents_fingerprint_shape check (
    public_key_fingerprint is null or public_key_fingerprint ~ '^[A-Fa-f0-9:]{16,191}$'
  )
);

create table if not exists public.atlas_local_agent_enrollments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  agent_name text not null check (char_length(btrim(agent_name)) between 1 and 120),
  enrollment_code_hash text not null unique check (enrollment_code_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint atlas_local_agent_enrollment_expiry check (expires_at > created_at)
);

create table if not exists public.atlas_local_agent_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.atlas_local_agents(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint atlas_local_agent_session_expiry check (expires_at > created_at)
);

create table if not exists public.atlas_local_devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.atlas_local_agents(id) on delete cascade,
  external_id text not null check (char_length(btrim(external_id)) between 1 and 160),
  label text not null check (char_length(btrim(label)) between 1 and 160),
  device_type text not null check (char_length(btrim(device_type)) between 1 and 80),
  adapter text not null check (char_length(btrim(adapter)) between 1 and 120),
  capabilities text[] not null default '{}',
  health_status text not null default 'unknown' check (health_status in ('unknown','healthy','degraded','offline','error')),
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_local_devices_agent_external_key unique (agent_id, external_id)
);

create table if not exists public.atlas_local_device_commands (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  device_id uuid not null references public.atlas_local_devices(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  capability text not null check (char_length(btrim(capability)) between 1 and 120),
  action text not null check (char_length(btrim(action)) between 1 and 120),
  risk_level text not null default 'low' check (risk_level in ('low','medium','high','critical')),
  approval_id uuid references public.execution_approvals(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','claimed','succeeded','failed','cancelled')),
  claimed_by_agent_id uuid references public.atlas_local_agents(id) on delete set null,
  claimed_at timestamptz,
  finished_at timestamptz,
  error_code text,
  correlation_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_local_device_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid references public.atlas_local_agents(id) on delete set null,
  device_id uuid references public.atlas_local_devices(id) on delete set null,
  command_id uuid references public.atlas_local_device_commands(id) on delete set null,
  event_type text not null check (char_length(btrim(event_type)) between 1 and 120),
  severity text not null default 'info' check (severity in ('info','warning','error','critical')),
  success boolean,
  safe_detail jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_detail) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists atlas_local_agents_org_status_idx
  on public.atlas_local_agents (org_id, status, last_seen_at desc);
create index if not exists atlas_local_agent_sessions_agent_expiry_idx
  on public.atlas_local_agent_sessions (agent_id, expires_at desc);
create index if not exists atlas_local_devices_org_agent_idx
  on public.atlas_local_devices (org_id, agent_id, health_status);
create index if not exists atlas_local_device_commands_org_status_idx
  on public.atlas_local_device_commands (org_id, status, created_at);
create index if not exists atlas_local_device_events_org_created_idx
  on public.atlas_local_device_events (org_id, created_at desc);

alter table public.atlas_local_agents enable row level security;
alter table public.atlas_local_agent_enrollments enable row level security;
alter table public.atlas_local_agent_sessions enable row level security;
alter table public.atlas_local_devices enable row level security;
alter table public.atlas_local_device_commands enable row level security;
alter table public.atlas_local_device_events enable row level security;

revoke all on public.atlas_local_agents from anon;
revoke all on public.atlas_local_agent_enrollments from anon;
revoke all on public.atlas_local_agent_sessions from anon;
revoke all on public.atlas_local_devices from anon;
revoke all on public.atlas_local_device_commands from anon;
revoke all on public.atlas_local_device_events from anon;

revoke all on public.atlas_local_agent_enrollments from authenticated;
revoke all on public.atlas_local_agent_sessions from authenticated;
revoke all on public.atlas_local_agents from authenticated;
revoke all on public.atlas_local_devices from authenticated;
revoke all on public.atlas_local_device_commands from authenticated;
revoke all on public.atlas_local_device_events from authenticated;

grant select on public.atlas_local_agents to authenticated;
grant select on public.atlas_local_devices to authenticated;
grant select on public.atlas_local_device_commands to authenticated;
grant select on public.atlas_local_device_events to authenticated;

grant all on public.atlas_local_agents to service_role;
grant all on public.atlas_local_agent_enrollments to service_role;
grant all on public.atlas_local_agent_sessions to service_role;
grant all on public.atlas_local_devices to service_role;
grant all on public.atlas_local_device_commands to service_role;
grant all on public.atlas_local_device_events to service_role;

drop policy if exists atlas_local_agents_read on public.atlas_local_agents;
create policy atlas_local_agents_read
on public.atlas_local_agents for select to authenticated
using (
  public.has_identity_permission(org_id, 'device.agent.read')
  or public.has_identity_permission(org_id, 'device.agent.admin')
);

drop policy if exists atlas_local_devices_read on public.atlas_local_devices;
create policy atlas_local_devices_read
on public.atlas_local_devices for select to authenticated
using (
  public.has_identity_permission(org_id, 'device.agent.read')
  or public.has_identity_permission(org_id, 'device.agent.use')
  or public.has_identity_permission(org_id, 'device.agent.admin')
);

drop policy if exists atlas_local_device_commands_read on public.atlas_local_device_commands;
create policy atlas_local_device_commands_read
on public.atlas_local_device_commands for select to authenticated
using (
  public.has_identity_permission(org_id, 'device.agent.read')
  or public.has_identity_permission(org_id, 'device.agent.use')
  or public.has_identity_permission(org_id, 'device.agent.admin')
);

drop policy if exists atlas_local_device_events_read on public.atlas_local_device_events;
create policy atlas_local_device_events_read
on public.atlas_local_device_events for select to authenticated
using (
  public.has_identity_permission(org_id, 'device.agent.read')
  or public.has_identity_permission(org_id, 'device.agent.admin')
);

comment on table public.atlas_local_agent_enrollments is
  'One-time Local Agent enrollment digests. Plain enrollment codes are never stored.';
comment on table public.atlas_local_agent_sessions is
  'Short-lived Local Agent session digests. Plain agent tokens are never stored.';
comment on table public.atlas_local_device_commands is
  'Reference-only local device actions. Arbitrary secret-bearing action payloads are intentionally not persisted.';
comment on table public.atlas_local_device_events is
  'Append-only safe Local Control Plane telemetry; provider/device secrets are prohibited.';
