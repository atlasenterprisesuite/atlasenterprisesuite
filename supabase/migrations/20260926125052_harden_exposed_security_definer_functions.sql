-- Keep privileged implementations out of the Data API schema. Public RPCs remain
-- SECURITY INVOKER facades, while the private implementations retain their existing
-- authorization checks and RLS-recursion protection.

create schema if not exists private authorization postgres;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

alter function public.atlas_chat_can_access(uuid, uuid, uuid) set schema private;
alter function public.atlas_chat_api(text, uuid, jsonb) set schema private;
alter function public.has_oracle_entitlement(text) set schema private;

revoke all on function private.atlas_chat_can_access(uuid, uuid, uuid) from public, anon;
revoke all on function private.atlas_chat_api(text, uuid, jsonb) from public, anon;
revoke all on function private.has_oracle_entitlement(text) from public, anon;
grant execute on function private.atlas_chat_can_access(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function private.atlas_chat_api(text, uuid, jsonb) to authenticated, service_role;
grant execute on function private.has_oracle_entitlement(text) to authenticated, service_role;

create or replace function public.atlas_chat_can_access(
  p_org_id uuid,
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.atlas_chat_can_access(p_org_id, p_conversation_id, p_user_id);
$$;

create or replace function public.atlas_chat_api(
  p_api text,
  p_org_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.atlas_chat_api(p_api, p_org_id, p_payload);
$$;

create or replace function public.has_oracle_entitlement(
  entitlement_key_value text default 'atlas.oracle.private'
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_oracle_entitlement(entitlement_key_value);
$$;

revoke all on function public.atlas_chat_can_access(uuid, uuid, uuid) from public, anon;
revoke all on function public.atlas_chat_api(text, uuid, jsonb) from public, anon;
revoke all on function public.has_oracle_entitlement(text) from public, anon;
grant execute on function public.atlas_chat_can_access(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.atlas_chat_api(text, uuid, jsonb) to authenticated, service_role;
grant execute on function public.has_oracle_entitlement(text) to authenticated, service_role;

comment on function public.atlas_chat_api(text, uuid, jsonb) is
  'Invoker facade for the private ATLAS Chat implementation; authorization remains fail-closed.';
comment on function public.has_oracle_entitlement(text) is
  'Invoker facade for the private entitlement lookup; returns only the caller entitlement boolean.';
