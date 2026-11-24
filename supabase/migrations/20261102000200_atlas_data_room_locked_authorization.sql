-- ATLAS 777 Secure Data Room: transactionally serialized read authorization.
-- Invoker-only function; caller must be a trusted server role with explicit
-- grants to the underlying tables. No public EXECUTE grant.
create or replace function public.atlas_data_room_authorize_read_locked(
  p_document_id uuid, p_actor_id uuid, p_organization_id uuid, p_tenant_id uuid
) returns boolean
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  v_document_id uuid;
  v_grant_id uuid;
begin
  if p_document_id is null or p_actor_id is null
     or p_organization_id is null or p_tenant_id is null then
    return false;
  end if;
  -- Lock order: document, then grant. Revocation must lock the same
  -- document row first, before modifying grant/document state.
  select d.id into v_document_id
  from public.atlas_data_room_documents d
  where d.id = p_document_id
    and d.organization_id = p_organization_id
    and d.tenant_id = p_tenant_id
    and d.revoked_at is null
  for update;
  if v_document_id is null then return false; end if;
  select g.id into v_grant_id
  from public.atlas_data_room_grants g
  where g.document_id = v_document_id
    and g.organization_id = p_organization_id
    and g.tenant_id = p_tenant_id
    and g.grantee_user_id = p_actor_id
    and g.revoked_at is null
    and (g.expires_at is null or g.expires_at > clock_timestamp())
  for update;
  return v_grant_id is not null;
end;
$$;
revoke all on function public.atlas_data_room_authorize_read_locked(uuid,uuid,uuid,uuid)
  from public, anon, authenticated;
-- NOT sufficient alone: caller identity, active membership, and live session
-- validation must be enforced by the server before any read operation.
-- The function is not granted to application roles and is not deployed.
