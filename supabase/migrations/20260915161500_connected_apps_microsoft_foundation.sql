-- ATLAS Connected Apps + Microsoft foundation.
-- Extends the canonical integration registry already used by Google/HubSpot.
-- No parallel connection store is created and no provider credential plaintext is exposed.

insert into public.identity_permissions (code, description)
values
  ('integrations.view', 'View sanitized Connected Apps metadata and audit history.'),
  ('integrations.use', 'Use an approved external-provider capability through the Integration Gateway.'),
  ('integrations.manage', 'Connect, reconnect, verify, and revoke user-facing external integrations.'),
  ('infrastructure.integrations.manage', 'Administer privileged environment-scoped infrastructure integrations.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'integrations.view'),
  ('owner', 'integrations.use'),
  ('owner', 'integrations.manage'),
  ('owner', 'infrastructure.integrations.manage'),
  ('admin', 'integrations.view'),
  ('admin', 'integrations.use'),
  ('admin', 'integrations.manage')
on conflict do nothing;

create table if not exists public.atlas_integration_providers (
  provider_key text primary key,
  display_name text not null check (length(trim(display_name)) > 0),
  connector_class text not null check (connector_class in ('user_oauth', 'infrastructure')),
  authorization_type text not null check (authorization_type in ('oauth2_pkce', 'oauth2', 'credential')),
  enabled boolean not null default true,
  supported_capabilities text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.atlas_integration_providers (
  provider_key,
  display_name,
  connector_class,
  authorization_type,
  supported_capabilities
)
values
  ('microsoft', 'Microsoft', 'user_oauth', 'oauth2_pkce', array[
    'microsoft.profile.read',
    'microsoft.mail.read',
    'microsoft.calendar.read',
    'microsoft.files.read'
  ]::text[]),
  ('google', 'Google', 'user_oauth', 'oauth2', array[
    'google.gmail.read',
    'google.calendar.read',
    'google.drive.read'
  ]::text[]),
  ('hubspot', 'HubSpot', 'user_oauth', 'oauth2', '{}'::text[])
on conflict (provider_key) do update
set display_name = excluded.display_name,
    connector_class = excluded.connector_class,
    authorization_type = excluded.authorization_type,
    supported_capabilities = excluded.supported_capabilities,
    updated_at = now();

-- Extend the existing provider constraints rather than introducing provider-specific stores.
alter table public.atlas_oauth_states
  drop constraint if exists atlas_oauth_states_provider_check;

alter table public.atlas_oauth_states
  add constraint atlas_oauth_states_provider_check
  check (provider in ('google', 'hubspot', 'microsoft'));

alter table public.atlas_integration_credentials
  drop constraint if exists atlas_integration_credentials_provider_check;

alter table public.atlas_integration_credentials
  add constraint atlas_integration_credentials_provider_check
  check (provider in ('google', 'hubspot', 'microsoft'));

alter table public.atlas_integration_credentials
  add column if not exists credential_kind text not null default 'oauth_tokens';

alter table public.atlas_integration_credentials
  drop constraint if exists atlas_integration_credentials_credential_kind_check;

alter table public.atlas_integration_credentials
  add constraint atlas_integration_credentials_credential_kind_check
  check (credential_kind in ('oauth_tokens', 'oauth_pkce_verifier', 'infrastructure_credential'));

-- OAuth state remains hashed in nonce_hash. The PKCE verifier is stored only as an
-- encrypted server-side credential record and referenced by opaque UUID.
alter table public.atlas_oauth_states
  add column if not exists code_verifier_credential_ref uuid
    references public.atlas_integration_credentials(id) on delete set null;

-- Preserve existing lifecycle values for Google/HubSpot while adding the richer
-- Connected Apps state machine for Microsoft and future adapters.
alter table public.atlas_integration_connections
  drop constraint if exists atlas_integration_connections_state_check;

alter table public.atlas_integration_connections
  add constraint atlas_integration_connections_state_check
  check (state in (
    'unconfigured',
    'not_connected',
    'authorizing',
    'connected',
    'connected_unverified',
    'verified',
    'degraded',
    'expired',
    'reconnect_required',
    'revoked',
    'error'
  ));

alter table public.atlas_integration_connections
  drop constraint if exists atlas_integration_connections_connected_truth_check;

alter table public.atlas_integration_connections
  add constraint atlas_integration_connections_connected_truth_check
  check (
    state not in ('connected', 'verified')
    or (authorized and provider_verified)
  );

alter table public.atlas_integration_connections
  add column if not exists connector_class text not null default 'user_oauth',
  add column if not exists environment text;

alter table public.atlas_integration_connections
  drop constraint if exists atlas_integration_connections_connector_class_check;

alter table public.atlas_integration_connections
  add constraint atlas_integration_connections_connector_class_check
  check (connector_class in ('user_oauth', 'infrastructure'));

alter table public.atlas_integration_connections
  drop constraint if exists atlas_integration_connections_environment_check;

alter table public.atlas_integration_connections
  add constraint atlas_integration_connections_environment_check
  check (environment is null or environment in ('development', 'staging', 'production'));

create table if not exists public.atlas_integration_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.atlas_integration_connections(id) on delete cascade,
  principal_type text not null check (principal_type in ('user', 'role', 'module')),
  principal_id text not null check (length(trim(principal_id)) > 0),
  module text not null check (length(trim(module)) > 0),
  capability text not null check (length(trim(capability)) > 0),
  granted_by uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint atlas_integration_grants_scope_key unique (
    connection_id,
    principal_type,
    principal_id,
    module,
    capability
  )
);

create table if not exists public.atlas_integration_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  provider text not null,
  connection_id uuid references public.atlas_integration_connections(id) on delete set null,
  action text not null check (length(trim(action)) > 0),
  status_before text,
  status_after text,
  requested_scopes text[] not null default '{}'::text[],
  module text,
  environment text check (environment is null or environment in ('development', 'staging', 'production')),
  approval_id uuid,
  correlation_id uuid not null default gen_random_uuid(),
  outcome text not null check (outcome in ('started', 'succeeded', 'failed', 'denied', 'pending')),
  provider_error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.atlas_integration_providers is
  'Non-secret provider catalog for ATLAS Connected Apps.';
comment on table public.atlas_integration_grants is
  'Tenant-scoped authorization mapping from an ATLAS principal/module to a provider capability.';
comment on table public.atlas_integration_events is
  'Metadata-only immutable-by-contract integration audit stream. Provider secrets are prohibited.';

create index if not exists atlas_integration_grants_org_connection_idx
  on public.atlas_integration_grants (org_id, connection_id, revoked_at);
create index if not exists atlas_integration_events_org_created_idx
  on public.atlas_integration_events (org_id, created_at desc);
create index if not exists atlas_integration_events_connection_created_idx
  on public.atlas_integration_events (connection_id, created_at desc);

alter table public.atlas_integration_providers enable row level security;
alter table public.atlas_integration_grants enable row level security;
alter table public.atlas_integration_events enable row level security;

revoke all on public.atlas_integration_providers from anon, authenticated;
grant select on public.atlas_integration_providers to authenticated;
grant all on public.atlas_integration_providers to service_role;

drop policy if exists atlas_integration_providers_select on public.atlas_integration_providers;
create policy atlas_integration_providers_select
  on public.atlas_integration_providers
  for select
  to authenticated
  using (true);

revoke all on public.atlas_integration_grants from anon, authenticated;
grant select on public.atlas_integration_grants to authenticated;
grant all on public.atlas_integration_grants to service_role;

drop policy if exists atlas_integration_grants_select on public.atlas_integration_grants;
create policy atlas_integration_grants_select
  on public.atlas_integration_grants
  for select
  to authenticated
  using (
    public.has_identity_permission(org_id, 'integrations.view')
    or public.has_identity_permission(org_id, 'integrations.read')
    or public.has_identity_permission(org_id, 'integrations.admin')
  );

revoke all on public.atlas_integration_events from anon, authenticated;
grant select on public.atlas_integration_events to authenticated;
grant all on public.atlas_integration_events to service_role;

drop policy if exists atlas_integration_events_select on public.atlas_integration_events;
create policy atlas_integration_events_select
  on public.atlas_integration_events
  for select
  to authenticated
  using (
    public.has_identity_permission(org_id, 'integrations.view')
    or public.has_identity_permission(org_id, 'integrations.read')
    or public.has_identity_permission(org_id, 'audit.read')
  );

-- Credentials remain server-only. Reassert this boundary after extension.
revoke all on public.atlas_integration_credentials from anon, authenticated;
grant all on public.atlas_integration_credentials to service_role;

-- User-visible connection metadata remains read-only in the browser and scoped
-- through the canonical identity permission function.
drop policy if exists atlas_integration_connections_select on public.atlas_integration_connections;
create policy atlas_integration_connections_select
  on public.atlas_integration_connections
  for select
  to authenticated
  using (
    public.has_identity_permission(org_id, 'integrations.view')
    or public.has_identity_permission(org_id, 'integrations.read')
  );
