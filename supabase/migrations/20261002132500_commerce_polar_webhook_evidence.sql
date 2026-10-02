-- ATLAS Commerce provider-event evidence.
-- Raw provider payloads are deliberately not persisted. A signed event becomes durable
-- evidence only after server-side verification, and remains unbound until a separate
-- tenant/customer mapping is proven.

create table if not exists public.commerce_provider_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  provider text not null check (provider in ('polar')),
  provider_event_id text not null check (length(trim(provider_event_id)) between 1 and 240),
  event_type text not null check (length(trim(event_type)) between 1 and 160),
  subject_reference text,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  processing_state text not null default 'verified_unbound'
    check (processing_state in ('verified_unbound','bound','ignored','processing_failed')),
  failure_code text,
  verified_at timestamptz not null,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists commerce_provider_events_org_received_idx
  on public.commerce_provider_events(org_id, received_at desc);

create index if not exists commerce_provider_events_provider_type_idx
  on public.commerce_provider_events(provider, event_type, received_at desc);

alter table public.commerce_provider_events enable row level security;

-- Provider evidence is server-control-plane data. Browser clients cannot read or mutate it.
revoke all on public.commerce_provider_events from anon;
revoke all on public.commerce_provider_events from authenticated;
grant all on public.commerce_provider_events to service_role;

comment on table public.commerce_provider_events is
  'Server-only immutable-ish evidence for cryptographically verified external Commerce events. verified_unbound must not grant subscription or payment entitlement.';
