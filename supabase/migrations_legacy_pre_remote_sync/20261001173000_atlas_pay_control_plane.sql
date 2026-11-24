-- ATLAS Pay governed control-plane foundation.
-- This migration creates organization-scoped readiness and intent records only.
-- It does not enable live card issuance, custody, bank accounts, payouts, settlement,
-- deposit insurance, ACH/RTP/FedNow access, or any other regulated financial rail.

insert into public.identity_permissions (code, description)
values
  ('pay.read', 'Read organization-scoped ATLAS Pay provider readiness, instrument and payout evidence.'),
  ('pay.manage', 'Manage ATLAS Pay provider configuration through governed server workflows.'),
  ('pay.execute', 'Request consequential ATLAS Pay actions through governed server workflows after all policy gates pass.')
on conflict (code) do nothing;

create table if not exists public.atlas_pay_provider_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider_key text not null check (length(trim(provider_key)) between 1 and 120),
  provider_kind text not null check (provider_kind in ('stripe_connect','sponsor_bank','ach','rtp','fednow','card_network')),
  environment text not null default 'sandbox' check (environment in ('sandbox','production')),
  authorization_state text not null default 'unverified' check (authorization_state in ('unverified','authorized','revoked','blocked')),
  credential_reference text,
  credentials_verified_at timestamptz,
  regulatory_coverage_state text not null default 'unverified' check (regulatory_coverage_state in ('unverified','verified','blocked')),
  capabilities text[] not null default '{}',
  currencies text[] not null default '{}',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider_key, environment)
);

create table if not exists public.atlas_pay_instrument_intents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider_connection_id uuid references public.atlas_pay_provider_connections(id) on delete set null,
  owner_reference text not null check (length(trim(owner_reference)) between 1 and 240),
  instrument_kind text not null check (instrument_kind in ('wallet','virtual_card','physical_card','business_card','payroll_card','vendor_card')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  state text not null default 'requested' check (state in ('requested','provider_pending','active','suspended','closed','failed','reconciliation_required')),
  provider_reference text,
  idempotency_key text not null check (length(trim(idempotency_key)) between 8 and 240),
  requested_by uuid not null,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);

create table if not exists public.atlas_pay_payout_intents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider_connection_id uuid references public.atlas_pay_provider_connections(id) on delete set null,
  owner_reference text not null check (length(trim(owner_reference)) between 1 and 240),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  method text not null check (method in ('standard','instant')),
  destination_reference text not null check (length(trim(destination_reference)) between 1 and 500),
  state text not null default 'requested' check (state in ('requested','provider_pending','paid','failed','reconciliation_required','cancelled')),
  provider_reference text,
  provider_fee_minor bigint not null default 0 check (provider_fee_minor >= 0),
  atlas_fee_minor bigint not null default 0 check (atlas_fee_minor >= 0),
  idempotency_key text not null check (length(trim(idempotency_key)) between 8 and 240),
  requested_by uuid not null,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);

create table if not exists public.atlas_pay_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('provider_connection','instrument_intent','payout_intent')),
  entity_id uuid not null,
  action text not null check (length(trim(action)) between 1 and 120),
  actor_user_id uuid,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.atlas_pay_provider_connections enable row level security;
alter table public.atlas_pay_instrument_intents enable row level security;
alter table public.atlas_pay_payout_intents enable row level security;
alter table public.atlas_pay_audit_events enable row level security;

drop policy if exists atlas_pay_provider_connections_read on public.atlas_pay_provider_connections;
create policy atlas_pay_provider_connections_read
on public.atlas_pay_provider_connections
for select to authenticated
using (
  public.has_identity_permission(org_id, 'pay.read')
  or public.has_identity_permission(org_id, 'pay.manage')
  or public.has_identity_permission(org_id, 'pay.execute')
);

drop policy if exists atlas_pay_instrument_intents_read on public.atlas_pay_instrument_intents;
create policy atlas_pay_instrument_intents_read
on public.atlas_pay_instrument_intents
for select to authenticated
using (
  public.has_identity_permission(org_id, 'pay.read')
  or public.has_identity_permission(org_id, 'pay.manage')
  or public.has_identity_permission(org_id, 'pay.execute')
);

drop policy if exists atlas_pay_payout_intents_read on public.atlas_pay_payout_intents;
create policy atlas_pay_payout_intents_read
on public.atlas_pay_payout_intents
for select to authenticated
using (
  public.has_identity_permission(org_id, 'pay.read')
  or public.has_identity_permission(org_id, 'pay.manage')
  or public.has_identity_permission(org_id, 'pay.execute')
);

drop policy if exists atlas_pay_audit_events_read on public.atlas_pay_audit_events;
create policy atlas_pay_audit_events_read
on public.atlas_pay_audit_events
for select to authenticated
using (
  public.has_identity_permission(org_id, 'pay.read')
  or public.has_identity_permission(org_id, 'pay.manage')
  or public.has_identity_permission(org_id, 'pay.execute')
);

-- Browser writes stay revoked. Consequential actions must enter through a governed
-- server boundary that resolves org scope, verifies permissions, provider readiness,
-- regulatory coverage, idempotency and authenticated provider evidence.
revoke insert, update, delete on public.atlas_pay_provider_connections from authenticated;
revoke insert, update, delete on public.atlas_pay_instrument_intents from authenticated;
revoke insert, update, delete on public.atlas_pay_payout_intents from authenticated;
revoke insert, update, delete on public.atlas_pay_audit_events from authenticated;

grant select on public.atlas_pay_provider_connections to authenticated;
grant select on public.atlas_pay_instrument_intents to authenticated;
grant select on public.atlas_pay_payout_intents to authenticated;
grant select on public.atlas_pay_audit_events to authenticated;

grant all on public.atlas_pay_provider_connections to service_role;
grant all on public.atlas_pay_instrument_intents to service_role;
grant all on public.atlas_pay_payout_intents to service_role;
grant all on public.atlas_pay_audit_events to service_role;
