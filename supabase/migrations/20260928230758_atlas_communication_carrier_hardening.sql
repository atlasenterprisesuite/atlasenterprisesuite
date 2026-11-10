revoke all on table public.atlas_telephony_providers from anon;
revoke all on table public.atlas_call_sessions from anon;
revoke all on table public.atlas_call_events from anon;
revoke all on table public.atlas_numbering_authorizations from anon;
revoke all on table public.atlas_number_resources from anon;

create index if not exists atlas_call_sessions_provider_id_idx
  on public.atlas_call_sessions(provider_id);
create index if not exists atlas_number_resources_authorization_id_idx
  on public.atlas_number_resources(authorization_id);
