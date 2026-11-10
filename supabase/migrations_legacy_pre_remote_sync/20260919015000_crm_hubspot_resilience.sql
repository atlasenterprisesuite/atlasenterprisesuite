-- ATLAS CRM + HubSpot production resilience.
-- Adds safe health/webhook metadata, scheduled provider verification, and
-- fail-closed internal monitoring. No CRM payloads or provider secrets are stored.

create table if not exists public.atlas_integration_health (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('hubspot')),
  connection_name text not null default 'default',
  status text not null default 'unknown' check (status in ('unknown','healthy','degraded','error','stale')),
  last_probe_at timestamptz,
  last_probe_success_at timestamptz,
  last_refresh_verified_at timestamptz,
  last_webhook_at timestamptz,
  last_reconcile_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_error_code text,
  object_checks jsonb not null default '{}'::jsonb check (jsonb_typeof(object_checks) = 'object'),
  reconcile_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(reconcile_summary) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, connection_name)
);

create table if not exists public.atlas_integration_webhook_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('hubspot')),
  provider_account_id text not null,
  event_key text not null,
  provider_event_id text,
  subscription_type text not null,
  provider_object_type text,
  provider_object_id text,
  property_name text,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz not null default now(),
  unique (provider, provider_account_id, event_key)
);

comment on table public.atlas_integration_health is
  'Safe provider health metadata for ATLAS integrations. Contains no provider credentials or CRM payloads.';
comment on table public.atlas_integration_webhook_events is
  'Idempotent HubSpot webhook metadata only. Provider payload values are never persisted.';

create index if not exists atlas_integration_health_org_provider_idx
  on public.atlas_integration_health (org_id, provider, updated_at desc);
create index if not exists atlas_integration_webhook_events_org_received_idx
  on public.atlas_integration_webhook_events (org_id, received_at desc);
create index if not exists atlas_integration_webhook_events_provider_event_idx
  on public.atlas_integration_webhook_events (provider_account_id, provider_event_id);

alter table public.atlas_integration_health enable row level security;
alter table public.atlas_integration_webhook_events enable row level security;

revoke all on public.atlas_integration_health from anon, authenticated;
revoke all on public.atlas_integration_webhook_events from anon, authenticated;
grant select on public.atlas_integration_health to authenticated;
grant select on public.atlas_integration_webhook_events to authenticated;
grant all on public.atlas_integration_health to service_role;
grant all on public.atlas_integration_webhook_events to service_role;

drop policy if exists atlas_integration_health_select on public.atlas_integration_health;
create policy atlas_integration_health_select
  on public.atlas_integration_health
  for select
  to authenticated
  using (
    public.has_identity_permission(org_id, 'integrations.read')
    or public.has_identity_permission(org_id, 'crm.read')
    or public.has_identity_permission(org_id, 'crm.admin')
  );

drop policy if exists atlas_integration_webhook_events_select on public.atlas_integration_webhook_events;
create policy atlas_integration_webhook_events_select
  on public.atlas_integration_webhook_events
  for select
  to authenticated
  using (
    public.has_identity_permission(org_id, 'integrations.read')
    or public.has_identity_permission(org_id, 'crm.read')
    or public.has_identity_permission(org_id, 'crm.admin')
  );

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'atlas_hubspot_monitor_trigger_v1') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'atlas_hubspot_monitor_trigger_v1',
      'ATLAS CRM HubSpot scheduled resilience monitor trigger'
    );
  end if;
end
$$;

create or replace function public.validate_atlas_hubspot_monitor_trigger(p_token text)
returns boolean
language sql
security definer
set search_path = public, vault, extensions, pg_catalog
as $$
  select coalesce(
    extensions.digest(convert_to(coalesce(p_token,''), 'UTF8'), 'sha256') =
    extensions.digest(
      convert_to(coalesce((
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'atlas_hubspot_monitor_trigger_v1'
        limit 1
      ), ''), 'UTF8'),
      'sha256'
    ),
    false
  );
$$;

revoke all on function public.validate_atlas_hubspot_monitor_trigger(text)
  from public, anon, authenticated;
grant execute on function public.validate_atlas_hubspot_monitor_trigger(text)
  to service_role;

select cron.schedule(
  'atlas-hubspot-resilience-v1',
  '23 * * * *',
  $cron$
  select net.http_post(
    url := 'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-crm-hubspot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-atlas-hubspot-monitor-token', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'atlas_hubspot_monitor_trigger_v1'
        limit 1
      )
    ),
    body := jsonb_build_object('operation','internal.monitor'),
    timeout_milliseconds := 120000
  ) as request_id;
  $cron$
);
