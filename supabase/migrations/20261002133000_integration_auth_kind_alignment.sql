-- Align the canonical integration registry with the provider/auth contract in packages/core.
-- This is additive to provider support and preserves the legacy-password exception rule.

alter table public.atlas_integration_connections
  drop constraint if exists atlas_integration_connections_auth_kind_check;

alter table public.atlas_integration_connections
  add constraint atlas_integration_connections_auth_kind_check
  check (
    auth_kind in (
      'oauth2',
      'oidc',
      'api_key',
      'service_token',
      'service_jwt',
      'signed_token',
      'opaque_reference',
      'password'
    )
  );

-- Keep the existing fail-closed truth rule explicit after schema evolution.
alter table public.atlas_integration_connections
  drop constraint if exists atlas_integration_connections_connected_truth_check;

alter table public.atlas_integration_connections
  add constraint atlas_integration_connections_connected_truth_check
  check (
    state <> 'connected'
    or (authorized = true and provider_verified = true)
  );

comment on constraint atlas_integration_connections_auth_kind_check
  on public.atlas_integration_connections is
  'Allowed credential-reference mechanisms for canonical ATLAS integrations. Password remains legacy-only and is governed by atlas_integration_connections_password_exception_check.';
