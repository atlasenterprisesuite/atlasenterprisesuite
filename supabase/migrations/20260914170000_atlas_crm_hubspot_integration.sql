-- ATLAS CRM + HubSpot integration persistence and authorization foundation.
-- P0 keeps HubSpot business data read-only and stores only connection,
-- credential ciphertext, linkage metadata, and safe operational evidence.

insert into public.identity_permissions (code, description)
values
  ('integrations.read', 'Read external integration connection metadata for an organization.'),
  ('integrations.write', 'Update non-administrative external integration configuration for an organization.'),
  ('integrations.admin', 'Connect, verify, disconnect, and administer external integrations for an organization.'),
  ('crm.read', 'Read CRM records exposed through an authorized provider connection.'),
  ('crm.sync', 'Run governed CRM refresh and synchronization metadata operations.'),
  ('crm.admin', 'Administer ATLAS CRM access and CRM integration behavior for an organization.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'integrations.read'),
  ('owner', 'integrations.write'),
  ('owner', 'integrations.admin'),
  ('owner', 'crm.read'),
  ('owner', 'crm.sync'),
  ('owner', 'crm.admin'),
  ('admin', 'integrations.read'),
  ('admin', 'integrations.write'),
  ('admin', 'integrations.admin'),
  ('admin', 'crm.read'),
  ('admin', 'crm.sync'),
  ('admin', 'crm.admin')
on conflict do nothing;

-- Extend the existing one-time OAuth state registry without rewriting the
-- historical Google migration.
alter table public.atlas_oauth_states
  drop constraint if exists atlas_oauth_states_provider_check;

alter table public.atlas_oauth_states
  add constraint atlas_oauth_states_provider_check
  check (provider in ('google', 'hubspot'));

-- Preserve the legacy Google permission while accepting the canonical
-- integration-admin permission for all new OAuth state creation.
drop policy if exists atlas_oauth_states_insert_authorized
  on public.atlas_oauth_states;

create policy atlas_oauth_states_insert_authorized
  on public.atlas_oauth_states
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.has_identity_permission(org_id, 'integrations.admin')
      or public.has_identity_permission(org_id, 'integrations.manage')
    )
  );

create table if not exists public.atlas_integration_credentials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('google', 'hubspot')),
  ciphertext text not null,
  iv text not null,
  algorithm text not null default 'AES-GCM-256',
  key_version text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.atlas_integration_credentials is
  'Server-only encrypted external-provider credentials. Plaintext access and refresh tokens are never stored in business tables.';

create table if not exists public.atlas_integration_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('google', 'hubspot')),
  state text not null default 'unconfigured' check (
    state in ('unconfigured', 'authorizing', 'connected', 'degraded', 'expired', 'revoked', 'error')
  ),
  provider_account_id text,
  provider_account_label text,
  granted_scopes text[] not null default '{}',
  credential_ref uuid references public.atlas_integration_credentials(id) on delete set null,
  last_verified_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_integration_connections_org_provider_key unique (org_id, provider)
);

comment on table public.atlas_integration_connections is
  'Organization-scoped provider connection metadata. Connected state requires provider verification and contains no credential plaintext.';

create table if not exists public.atlas_external_object_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('google', 'hubspot')),
  provider_account_id text not null,
  provider_object_type text not null,
  provider_object_id text not null,
  atlas_object_type text,
  atlas_object_id uuid,
  last_seen_at timestamptz not null,
  source_updated_at timestamptz,
  source_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_external_object_links_provider_key unique (
    org_id,
    provider,
    provider_account_id,
    provider_object_type,
    provider_object_id
  )
);

comment on table public.atlas_external_object_links is
  'Minimal provider-object linkage and reconciliation metadata; not a shadow CRM record store.';

create table if not exists public.atlas_integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('google', 'hubspot')),
  operation text not null,
  object_type text,
  status text not null check (status in ('started', 'completed', 'failed', 'denied', 'rate_limited')),
  cursor_in text,
  cursor_out text,
  records_observed integer not null default 0 check (records_observed >= 0),
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text,
  evidence_ref text
);

comment on table public.atlas_integration_sync_runs is
  'Safe operational evidence for integration reads/refreshes. CRM record payloads and provider credentials are prohibited.';

create index if not exists atlas_integration_credentials_org_provider_idx
  on public.atlas_integration_credentials (org_id, provider, created_at desc);

create index if not exists atlas_integration_connections_org_state_idx
  on public.atlas_integration_connections (org_id, state, updated_at desc);

create index if not exists atlas_external_object_links_lookup_idx
  on public.atlas_external_object_links (
    org_id,
    provider,
    provider_account_id,
    provider_object_type,
    provider_object_id
  );

create index if not exists atlas_integration_sync_runs_org_started_idx
  on public.atlas_integration_sync_runs (org_id, started_at desc);

alter table public.atlas_integration_credentials enable row level security;
alter table public.atlas_integration_connections enable row level security;
alter table public.atlas_external_object_links enable row level security;
alter table public.atlas_integration_sync_runs enable row level security;

-- Credential ciphertext is server-only. There is deliberately no browser RLS
-- policy for this table.
revoke all on public.atlas_integration_credentials from anon, authenticated;
grant all on public.atlas_integration_credentials to service_role;

revoke all on public.atlas_integration_connections from anon, authenticated;
grant select on public.atlas_integration_connections to authenticated;
grant all on public.atlas_integration_connections to service_role;

revoke all on public.atlas_external_object_links from anon, authenticated;
grant select on public.atlas_external_object_links to authenticated;
grant all on public.atlas_external_object_links to service_role;

revoke all on public.atlas_integration_sync_runs from anon, authenticated;
grant select on public.atlas_integration_sync_runs to authenticated;
grant all on public.atlas_integration_sync_runs to service_role;

drop policy if exists atlas_integration_connections_select on public.atlas_integration_connections;
create policy atlas_integration_connections_select
  on public.atlas_integration_connections
  for select
  to authenticated
  using (
    public.has_identity_permission(org_id, 'integrations.read')
    or public.has_identity_permission(org_id, 'integrations.admin')
    or public.has_identity_permission(org_id, 'integrations.manage')
  );

drop policy if exists atlas_external_object_links_select on public.atlas_external_object_links;
create policy atlas_external_object_links_select
  on public.atlas_external_object_links
  for select
  to authenticated
  using (
    public.has_identity_permission(org_id, 'crm.read')
    or public.has_identity_permission(org_id, 'crm.admin')
  );

drop policy if exists atlas_integration_sync_runs_select on public.atlas_integration_sync_runs;
create policy atlas_integration_sync_runs_select
  on public.atlas_integration_sync_runs
  for select
  to authenticated
  using (
    public.has_identity_permission(org_id, 'crm.read')
    or public.has_identity_permission(org_id, 'crm.sync')
    or public.has_identity_permission(org_id, 'crm.admin')
  );
