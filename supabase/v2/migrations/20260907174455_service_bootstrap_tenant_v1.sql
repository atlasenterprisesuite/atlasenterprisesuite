drop function if exists public.bootstrap_atlas_tenant(text, text, text, text);

create or replace function public.bootstrap_atlas_tenant_service(
  p_actor_id uuid,
  p_tenant_name text,
  p_tenant_slug text,
  p_organization_name text,
  p_organization_slug text
)
returns table(tenant_id uuid, organization_id uuid)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_tenant_id uuid;
  v_org_id uuid;
begin
  if p_actor_id is null or not exists (select 1 from auth.users where id = p_actor_id) then
    raise exception 'Valid authenticated actor is required';
  end if;

  if length(trim(coalesce(p_tenant_name,''))) = 0 or length(trim(coalesce(p_organization_name,''))) = 0 then
    raise exception 'Tenant and organization names are required';
  end if;

  if p_tenant_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'
     or p_organization_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'Invalid slug';
  end if;

  insert into public.tenants(name, slug, created_by)
  values (trim(p_tenant_name), p_tenant_slug, p_actor_id)
  returning id into v_tenant_id;

  insert into public.organizations(tenant_id, name, slug, created_by)
  values (v_tenant_id, trim(p_organization_name), p_organization_slug, p_actor_id)
  returning id into v_org_id;

  insert into public.organization_members(tenant_id, org_id, user_id, role, status)
  values (v_tenant_id, v_org_id, p_actor_id, 'owner', 'active');

  insert into public.organization_modules(tenant_id, org_id, module_code, enabled)
  values (v_tenant_id, v_org_id, 'core', true);

  insert into public.audit_logs(tenant_id, org_id, actor_id, action, entity_type, entity_id, after_state)
  values (
    v_tenant_id,
    v_org_id,
    p_actor_id,
    'tenant.bootstrap',
    'organization',
    v_org_id::text,
    jsonb_build_object('tenant_id', v_tenant_id, 'organization_id', v_org_id, 'role', 'owner', 'core_enabled', true)
  );

  return query select v_tenant_id, v_org_id;
end;
$$;

revoke all on function public.bootstrap_atlas_tenant_service(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_atlas_tenant_service(uuid, text, text, text, text) to service_role;
