-- ATLAS Pay Accounts Center Wave 1.
-- Adds organization-scoped financial profiles and append-only source-backed balance evidence.
-- This does not create custody, a deposit account, a shadow GL, or live provider capability.

create table if not exists public.atlas_pay_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_key text not null check (length(trim(account_key)) between 1 and 160),
  display_label text not null check (length(trim(display_label)) between 1 and 160),
  account_kind text not null check (account_kind in ('person','organization','brand','creator','external')),
  state text not null default 'active' check (state in ('active','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, account_key)
);

create table if not exists public.atlas_pay_balance_evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.atlas_pay_accounts(id) on delete cascade,
  provider_connection_id uuid references public.atlas_pay_provider_connections(id) on delete set null,
  balance_kind text not null check (balance_kind in ('wallet','earnings','rewards','credits')),
  amount_minor bigint not null,
  amount_minor_text text generated always as (amount_minor::text) stored,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  state text not null check (state in ('available','pending','held','unavailable')),
  source_kind text not null check (source_kind in ('atlas_control_plane','external_provider','manual_evidence')),
  source_reference text not null check (length(trim(source_reference)) between 1 and 500),
  observed_at timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists atlas_pay_accounts_org_state_idx
  on public.atlas_pay_accounts (org_id, state, created_at desc);

create index if not exists atlas_pay_balance_evidence_latest_idx
  on public.atlas_pay_balance_evidence
  (org_id, account_id, balance_kind, currency, source_kind, source_reference, observed_at desc);

alter table public.atlas_pay_accounts enable row level security;
alter table public.atlas_pay_balance_evidence enable row level security;

drop policy if exists atlas_pay_accounts_read on public.atlas_pay_accounts;
create policy atlas_pay_accounts_read
on public.atlas_pay_accounts
for select to authenticated
using (
  public.has_identity_permission(org_id, 'pay.read')
  or public.has_identity_permission(org_id, 'pay.manage')
  or public.has_identity_permission(org_id, 'pay.execute')
);

drop policy if exists atlas_pay_balance_evidence_read on public.atlas_pay_balance_evidence;
create policy atlas_pay_balance_evidence_read
on public.atlas_pay_balance_evidence
for select to authenticated
using (
  public.has_identity_permission(org_id, 'pay.read')
  or public.has_identity_permission(org_id, 'pay.manage')
  or public.has_identity_permission(org_id, 'pay.execute')
);

revoke insert, update, delete on public.atlas_pay_accounts from authenticated;
revoke insert, update, delete on public.atlas_pay_balance_evidence from authenticated;

grant select on public.atlas_pay_accounts to authenticated;
grant select on public.atlas_pay_balance_evidence to authenticated;

grant all on public.atlas_pay_accounts to service_role;
grant all on public.atlas_pay_balance_evidence to service_role;

alter table public.atlas_pay_audit_events
  drop constraint if exists atlas_pay_audit_events_entity_type_check;

alter table public.atlas_pay_audit_events
  add constraint atlas_pay_audit_events_entity_type_check
  check (entity_type in ('provider_connection','instrument_intent','payout_intent','account','balance_evidence'));
