drop policy if exists organization_members_select_scope on public.organization_members;

create policy organization_members_select_self on public.organization_members
for select to authenticated
using (user_id = auth.uid());

create or replace function public.atlas_is_org_member(p_tenant_id uuid, p_org_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.org_id and o.tenant_id = m.tenant_id
    join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = p_tenant_id
      and m.org_id = p_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and o.active = true
      and t.status = 'active'
  );
$$;

create or replace function public.atlas_is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.org_id and o.tenant_id = m.tenant_id
    join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and o.active = true
      and t.status = 'active'
  );
$$;

create or replace function public.has_identity_permission(p_tenant_id uuid, p_org_id uuid, p_permission text)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select override.allowed
      from public.organization_members membership
      join public.organization_role_permissions override
        on override.tenant_id = membership.tenant_id
       and override.org_id = membership.org_id
       and override.role = membership.role
       and override.permission_code = p_permission
      where membership.tenant_id = p_tenant_id
        and membership.org_id = p_org_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
      limit 1
    ),
    exists (
      select 1
      from public.organization_members membership
      join public.identity_role_permissions defaults
        on defaults.role = membership.role
       and defaults.permission_code = p_permission
      where membership.tenant_id = p_tenant_id
        and membership.org_id = p_org_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
    ),
    false
  );
$$;

revoke all on function public.bootstrap_atlas_tenant(text, text, text, text) from authenticated;
grant execute on function public.bootstrap_atlas_tenant(text, text, text, text) to service_role;
