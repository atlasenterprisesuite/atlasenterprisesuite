-- ATLAS Background Brain lifecycle hardening.
-- Adds an explicit cancelled terminal state and an idempotent provider webhook receipt ledger.

alter table public.atlas_ai_requests
  drop constraint if exists atlas_ai_requests_status_check;

alter table public.atlas_ai_requests
  add constraint atlas_ai_requests_status_check
  check (status in ('started','completed','failed','denied','cancelled'));

create index if not exists atlas_ai_requests_background_activity_idx
  on public.atlas_ai_requests (org_id, actor_id, status, created_at desc);

create table if not exists public.atlas_ai_webhook_events (
  webhook_id text primary key check (char_length(webhook_id) between 4 and 200),
  provider text not null check (provider in ('openai')),
  event_type text not null check (char_length(event_type) between 3 and 160),
  response_id text check (response_id is null or char_length(response_id) between 4 and 240),
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_state text not null default 'received' check (processing_state in ('received','processed','ignored','failed')),
  error_code text
);

alter table public.atlas_ai_webhook_events enable row level security;
revoke all on public.atlas_ai_webhook_events from anon, authenticated;

comment on table public.atlas_ai_webhook_events is
  'Service-role-only idempotency ledger for signed provider webhook receipts; full payloads are not retained.';
