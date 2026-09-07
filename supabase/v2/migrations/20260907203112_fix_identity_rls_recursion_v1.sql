create or replace function private.atlas_is_org_member(
  p_tenant_id uuid,
  p_org_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o
      on o.id = m.org_id and o.tenant_id = m.tenant_id
    join public.tenants t
      on t.id = m.tenant_id
    where m.tenant_id = p_tenant_id
      and m.org_id = p_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and o.active = true
      and t.status = 'active'
  );
$$;

create or replace function private.atlas_is_tenant_member(
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o
      on o.id = m.org_id and o.tenant_id = m.tenant_id
    join public.tenants t
      on t.id = m.tenant_id
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and o.active = true
      and t.status = 'active'
  );
$$;

revoke all on function private.atlas_is_org_member(uuid, uuid) from public, anon;
revoke all on function private.atlas_is_tenant_member(uuid) from public, anon;
grant execute on function private.atlas_is_org_member(uuid, uuid) to authenticated;
grant execute on function private.atlas_is_tenant_member(uuid) to authenticated;

create or replace function public.atlas_is_org_member(
  p_tenant_id uuid,
  p_org_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$
  select private.atlas_is_org_member(p_tenant_id, p_org_id);
$$;

create or replace function public.atlas_is_tenant_member(
  p_tenant_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$
  select private.atlas_is_tenant_member(p_tenant_id);
$$;

revoke all on function public.atlas_is_org_member(uuid, uuid) from public, anon;
revoke all on function public.atlas_is_tenant_member(uuid) from public, anon;
grant execute on function public.atlas_is_org_member(uuid, uuid) to authenticated;
grant execute on function public.atlas_is_tenant_member(uuid) to authenticated;