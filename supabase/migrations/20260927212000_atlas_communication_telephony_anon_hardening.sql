-- Harden ATLAS Communication telephony tables against direct anonymous Data API access.
-- RLS already fails closed; this removes inherited table privileges as defense in depth.
revoke all on public.atlas_telephony_providers from anon;
revoke all on public.atlas_call_sessions from anon;
revoke all on public.atlas_call_events from anon;
