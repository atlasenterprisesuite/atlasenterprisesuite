-- ATLAS Pay FK index hardening.
-- Mirrors the production migration applied after Supabase advisor verification.

create index if not exists atlas_pay_audit_events_org_created_idx
  on public.atlas_pay_audit_events (org_id, created_at desc);

create index if not exists atlas_pay_instrument_intents_provider_connection_idx
  on public.atlas_pay_instrument_intents (provider_connection_id)
  where provider_connection_id is not null;

create index if not exists atlas_pay_payout_intents_provider_connection_idx
  on public.atlas_pay_payout_intents (provider_connection_id)
  where provider_connection_id is not null;
