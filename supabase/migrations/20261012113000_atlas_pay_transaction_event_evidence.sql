-- ATLAS Financial OS Day 2: immutable, org-scoped provider event evidence.
-- No bank custody, settlement, live rails or money movement is enabled.
-- PRECONDITION: apply and validate 20261006190000_atlas_pay_accounts_center.sql first.
do $$
begin
  if to_regclass('public.atlas_pay_accounts') is null
    or to_regclass('public.atlas_pay_balance_evidence') is null then
    raise exception 'P0: ATLAS Pay Accounts Center prerequisite migration missing';
  end if;
end $$;

-- Composite constraints ensure a matching UUID from another organization is not accepted.
create unique index if not exists atlas_pay_accounts_org_id_id_uq
  on public.atlas_pay_accounts (org_id, id);
create unique index if not exists atlas_pay_providers_org_id_id_uq
  on public.atlas_pay_provider_connections (org_id, id);

create table if not exists public.atlas_pay_transaction_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  account_id uuid not null,
  provider_connection_id uuid not null,
  provider_event_id text not null check (length(trim(provider_event_id)) between 1 and 200),
  transaction_reference text not null check (length(trim(transaction_reference)) between 1 and 240),
  event_kind text not null check (event_kind in ('authorization','posting','release')),
  amount_minor bigint not null check (amount_minor > 0),
  amount_minor_text text generated always as (amount_minor::text) stored,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  observed_at timestamptz not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  signature_scheme text not null default 'atlas-internal-hmac-sha256-v1'
    check (signature_scheme = 'atlas-internal-hmac-sha256-v1'),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint atlas_pay_event_tenant_account_fk
    foreign key (org_id, account_id)
    references public.atlas_pay_accounts(org_id, id) on delete restrict,
  constraint atlas_pay_event_tenant_provider_fk
    foreign key (org_id, provider_connection_id)
    references public.atlas_pay_provider_connections(org_id, id) on delete restrict,
  constraint atlas_pay_event_provider_idempotency
    unique (org_id, provider_connection_id, provider_event_id)
);

create index if not exists atlas_pay_txn_scope_recent_idx
  on public.atlas_pay_transaction_events
  (org_id, account_id, provider_connection_id, transaction_reference, observed_at desc);

alter table public.atlas_pay_transaction_events enable row level security;
alter table public.atlas_pay_transaction_events force row level security;

drop policy if exists atlas_pay_transaction_events_read on public.atlas_pay_transaction_events;
create policy atlas_pay_transaction_events_read
on public.atlas_pay_transaction_events for select to authenticated
using (
  public.has_identity_permission(org_id, 'pay.read')
  or public.has_identity_permission(org_id, 'pay.manage')
  or public.has_identity_permission(org_id, 'pay.execute')
);

-- No browser writes; service_role can only use the validated RPC below.
revoke all on public.atlas_pay_transaction_events from public, anon, authenticated, service_role;
grant select on public.atlas_pay_transaction_events to authenticated, service_role;

create or replace function public.atlas_pay_transaction_event_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'ATLAS Pay provider event evidence is append-only'
    using errcode = '42501';
end;
$$;

drop trigger if exists atlas_pay_transaction_events_append_only on public.atlas_pay_transaction_events;
create trigger atlas_pay_transaction_events_append_only
before update or delete on public.atlas_pay_transaction_events
for each row execute function public.atlas_pay_transaction_event_immutable();

revoke all on function public.atlas_pay_transaction_event_immutable() from public, anon, authenticated;

-- Extend the existing Pay audit taxonomy without creating a second audit ledger.
alter table public.atlas_pay_audit_events
  drop constraint if exists atlas_pay_audit_events_entity_type_check;
alter table public.atlas_pay_audit_events
  add constraint atlas_pay_audit_events_entity_type_check
  check (entity_type in (
    'provider_connection', 'instrument_intent', 'payout_intent',
    'account', 'balance_evidence', 'transaction_event'
  ));

-- Service-only transactional write: one event and one audit record, or neither.
-- The outer adapter MUST authenticate both native provider delivery and the
-- canonical internal HMAC envelope before invoking this RPC.
create or replace function public.atlas_pay_record_transaction_event(
  p_org_id uuid,
  p_account_id uuid,
  p_provider_connection_id uuid,
  p_provider_event_id text,
  p_transaction_reference text,
  p_event_kind text,
  p_amount_minor bigint,
  p_currency text,
  p_observed_at timestamptz,
  p_payload_sha256 text
) returns table (receipt_id uuid, receipt_state text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_old public.atlas_pay_transaction_events%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if p_org_id is null or p_account_id is null or p_provider_connection_id is null
    or p_provider_event_id is null or length(trim(p_provider_event_id)) not between 1 and 200
    or p_transaction_reference is null or length(trim(p_transaction_reference)) not between 1 and 240
    or p_event_kind not in ('authorization', 'posting', 'release')
    or p_amount_minor is null or p_amount_minor <= 0
    or p_currency is null or p_currency !~ '^[A-Z]{3}$'
    or p_observed_at is null
    or p_payload_sha256 is null or p_payload_sha256 !~ '^[a-f0-9]{64}$'
  then
    raise exception 'invalid authenticated event fields' using errcode = '22023';
  end if;

  perform 1 from public.atlas_pay_accounts
  where id = p_account_id and org_id = p_org_id and state = 'active' for key share;
  if not found then
    raise exception 'account not verified for organization' using errcode = '42501';
  end if;

  perform 1 from public.atlas_pay_provider_connections
  where id = p_provider_connection_id and org_id = p_org_id
    and authorization_state = 'authorized'
    and regulatory_coverage_state = 'verified'
    and credentials_verified_at is not null for key share;
  if not found then
    raise exception 'provider not verified for organization' using errcode = '42501';
  end if;

  insert into public.atlas_pay_transaction_events(
    org_id, account_id, provider_connection_id, provider_event_id,
    transaction_reference, event_kind, amount_minor, currency,
    observed_at, payload_sha256
  ) values (
    p_org_id, p_account_id, p_provider_connection_id, p_provider_event_id,
    p_transaction_reference, p_event_kind, p_amount_minor, p_currency,
    p_observed_at, p_payload_sha256
  )
  on conflict (org_id, provider_connection_id, provider_event_id) do nothing
  returning id into v_id;

  if v_id is not null then
    insert into public.atlas_pay_audit_events (
      org_id, entity_type, entity_id, action, evidence
    ) values (
      p_org_id, 'transaction_event', v_id, 'verified_event_ingested',
      pg_catalog.jsonb_build_object(
        'provider_connection_id', p_provider_connection_id,
        'provider_event_id', p_provider_event_id,
        'payload_sha256', p_payload_sha256
      )
    );
    return query select v_id, 'inserted'::text;
    return;
  end if;

  select * into v_old from public.atlas_pay_transaction_events
  where org_id = p_org_id and provider_connection_id = p_provider_connection_id
    and provider_event_id = p_provider_event_id;

  if found and v_old.account_id = p_account_id
    and v_old.transaction_reference = p_transaction_reference
    and v_old.event_kind = p_event_kind
    and v_old.amount_minor = p_amount_minor
    and v_old.currency = p_currency
    and v_old.observed_at = p_observed_at
    and v_old.payload_sha256 = p_payload_sha256 then
    return query select v_old.id, 'duplicate'::text;
    return;
  end if;

  raise exception 'conflicting provider event identifier' using errcode = '23505';
end;
$$;

revoke all on function public.atlas_pay_record_transaction_event(
  uuid, uuid, uuid, text, text, text, bigint, text, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.atlas_pay_record_transaction_event(
  uuid, uuid, uuid, text, text, text, bigint, text, timestamptz, text
) to service_role;
