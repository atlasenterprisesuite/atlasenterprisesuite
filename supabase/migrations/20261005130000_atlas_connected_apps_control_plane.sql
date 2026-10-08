-- ATLAS Connected Apps Control Plane foundation.
-- Additive only: preserve the canonical integration registry and legacy
-- persisted `unconfigured` state while the provider-neutral layer renders it
-- as `disconnected`.

insert into public.identity_permissions (code, description)
values
  ('connected_apps.read', 'Read organization-scoped Connected Apps catalog and safe connection metadata.'),
  ('connected_apps.connect', 'Start governed Connected Apps authorization for an organization.'),
  ('connected_apps.manage', 'Verify and administer organization-scoped Connected Apps connections.'),
  ('connected_apps.disconnect', 'Disconnect an external application from an organization.'),
  ('connected_apps.policy.read', 'Read Connected Apps execution policies.'),
  ('connected_apps.policy.manage', 'Create and update Connected Apps execution policies.'),
  ('connected_apps.audit.read', 'Read Connected Apps access and execution evidence.'),
  ('connected_apps.retention.manage', 'Manage Connected Apps retention and deletion requests.'),
  ('connected_apps.agent.use', 'Permit ATLAS agents to discover policy-filtered Connected Apps capabilities.')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'connected_apps.read'),
  ('owner', 'connected_apps.connect'),
  ('owner', 'connected_apps.manage'),
  ('owner', 'connected_apps.disconnect'),
  ('owner', 'connected_apps.policy.read'),
  ('owner', 'connected_apps.policy.manage'),
  ('owner', 'connected_apps.audit.read'),
  ('owner', 'connected_apps.retention.manage'),
  ('owner', 'connected_apps.agent.use'),
  ('admin', 'connected_apps.read'),
  ('admin', 'connected_apps.connect'),
  ('admin', 'connected_apps.manage'),
  ('admin', 'connected_apps.disconnect'),
  ('admin', 'connected_apps.policy.read'),
  ('admin', 'connected_apps.policy.manage'),
  ('admin', 'connected_apps.audit.read'),
  ('admin', 'connected_apps.retention.manage'),
  ('admin', 'connected_apps.agent.use')
on conflict do nothing;

alter table public.atlas_integration_connections
  add column if not exists expires_at timestamptz,
  add column if not exists last_error_summary text;

comment on column public.atlas_integration_connections.expires_at is
  'Provider authorization expiry when known; null means unknown, not unlimited.';
comment on column public.atlas_integration_connections.last_error_summary is
  'Sanitized provider-neutral error summary. Secret or raw provider payloads are prohibited.';

create table if not exists public.atlas_connected_app_capabilities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.atlas_integration_connections(id) on delete cascade,
  capability_code text not null check (length(trim(capability_code)) > 0),
  provider_scopes text[] not null default '{}',
  access_level text not null check (access_level in ('read','write','admin','consequential')),
  authorized boolean not null default false,
  verified boolean not null default false,
  verification_source text,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, capability_code)
);

create table if not exists public.atlas_connected_app_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.atlas_integration_connections(id) on delete cascade,
  capability_pattern text not null check (length(trim(capability_pattern)) > 0),
  effect text not null check (effect in ('allow','approval_required','deny')),
  actor_kind text not null default 'any' check (actor_kind in ('user','agent','workflow','any')),
  role_constraints text[] not null default '{}',
  data_classification text,
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, connection_id, capability_pattern, actor_kind)
);

create table if not exists public.atlas_connected_app_access_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.atlas_integration_connections(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_kind text not null check (actor_kind in ('user','agent','workflow','system')),
  source_ref text,
  capability_code text not null check (length(trim(capability_code)) > 0),
  provider_operation_class text,
  target_resource_class text,
  target_resource_id text,
  decision text not null check (decision in ('allowed','approval_required','denied','executed','failed')),
  approval_ref uuid references public.execution_approvals(id) on delete set null,
  evidence_ref text,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_connected_app_data_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.atlas_integration_connections(id) on delete set null,
  data_category text not null check (length(trim(data_category)) > 0),
  purpose text not null check (length(trim(purpose)) > 0),
  storage_mode text not null check (storage_mode in ('transient','cached','persisted')),
  first_accessed_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now(),
  retention_policy_code text,
  scheduled_deletion_at timestamptz,
  deletion_request_state text not null default 'none' check (
    deletion_request_state in ('none','requested','processing','completed','failed','not_supported')
  ),
  deletion_requested_at timestamptz,
  deletion_requested_by uuid references auth.users(id) on delete set null,
  deletion_evidence_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists atlas_connected_app_capabilities_org_idx
  on public.atlas_connected_app_capabilities (org_id, connection_id, capability_code);
create index if not exists atlas_connected_app_policies_org_idx
  on public.atlas_connected_app_policies (org_id, enabled, capability_pattern);
create index if not exists atlas_connected_app_access_events_org_idx
  on public.atlas_connected_app_access_events (org_id, created_at desc);
create index if not exists atlas_connected_app_data_ledger_org_idx
  on public.atlas_connected_app_data_ledger (org_id, deletion_request_state, updated_at desc);

alter table public.atlas_connected_app_capabilities enable row level security;
alter table public.atlas_connected_app_policies enable row level security;
alter table public.atlas_connected_app_access_events enable row level security;
alter table public.atlas_connected_app_data_ledger enable row level security;

drop policy if exists connected_app_capabilities_read on public.atlas_connected_app_capabilities;
create policy connected_app_capabilities_read on public.atlas_connected_app_capabilities
for select to authenticated
using (public.has_identity_permission(org_id, 'connected_apps.read'));

drop policy if exists connected_app_policies_read on public.atlas_connected_app_policies;
create policy connected_app_policies_read on public.atlas_connected_app_policies
for select to authenticated
using (
  public.has_identity_permission(org_id, 'connected_apps.policy.read')
  or public.has_identity_permission(org_id, 'connected_apps.policy.manage')
);

drop policy if exists connected_app_access_events_read on public.atlas_connected_app_access_events;
create policy connected_app_access_events_read on public.atlas_connected_app_access_events
for select to authenticated
using (public.has_identity_permission(org_id, 'connected_apps.audit.read'));

drop policy if exists connected_app_data_ledger_read on public.atlas_connected_app_data_ledger;
create policy connected_app_data_ledger_read on public.atlas_connected_app_data_ledger
for select to authenticated
using (
  public.has_identity_permission(org_id, 'connected_apps.read')
  or public.has_identity_permission(org_id, 'connected_apps.retention.manage')
);

revoke all on public.atlas_connected_app_capabilities from anon, authenticated;
revoke all on public.atlas_connected_app_policies from anon, authenticated;
revoke all on public.atlas_connected_app_access_events from anon, authenticated;
revoke all on public.atlas_connected_app_data_ledger from anon, authenticated;

grant select on public.atlas_connected_app_capabilities to authenticated;
grant select on public.atlas_connected_app_policies to authenticated;
grant select on public.atlas_connected_app_access_events to authenticated;
grant select on public.atlas_connected_app_data_ledger to authenticated;

grant all on public.atlas_connected_app_capabilities to service_role;
grant all on public.atlas_connected_app_policies to service_role;
grant all on public.atlas_connected_app_access_events to service_role;
grant all on public.atlas_connected_app_data_ledger to service_role;
