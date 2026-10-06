alter table public.execution_connection_refs
  add column if not exists display_label text,
  add column if not exists provider_account_ref text,
  add column if not exists provider_tenant_ref text,
  add column if not exists principal_label text,
  add column if not exists transport_capabilities jsonb not null default '[]'::jsonb,
  add column if not exists health_state text not null default 'unknown',
  add column if not exists verified_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_error_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'execution_connection_refs_health_state_check'
  ) then
    alter table public.execution_connection_refs
      add constraint execution_connection_refs_health_state_check
      check (health_state in (
        'unknown',
        'healthy',
        'degraded',
        'reauth_required',
        'insufficient_scope',
        'account_changed',
        'runtime_unavailable',
        'unavailable'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'execution_connection_refs_transport_capabilities_array_check'
  ) then
    alter table public.execution_connection_refs
      add constraint execution_connection_refs_transport_capabilities_array_check
      check (jsonb_typeof(transport_capabilities) = 'array');
  end if;
end $$;

create index if not exists execution_connection_refs_gateway_readiness_idx
  on public.execution_connection_refs (org_id, tenant_id, status, health_state, updated_at desc);

comment on column public.execution_connection_refs.transport_capabilities is
  'Normalized non-secret execution transports available to the connection: api, mcp, browser.';
comment on column public.execution_connection_refs.health_state is
  'Evidence-backed Agent Gateway health. Lifecycle status remains separate and active never implies healthy.';
comment on column public.execution_connection_refs.provider_account_ref is
  'Non-secret provider account identifier attested by a provider read-back path.';
comment on column public.execution_connection_refs.provider_tenant_ref is
  'Non-secret provider tenant/portal identifier attested by a provider read-back path.';
