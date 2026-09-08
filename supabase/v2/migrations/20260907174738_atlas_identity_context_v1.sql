create or replace function public.atlas_identity_context()
returns table(
  tenant_id uuid,
  tenant_name text,
  organization_id uuid,
  organization_name text,
  role text,
  permissions text[]
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    m.tenant_id,
    t.name as tenant_name,
    m.org_id as organization_id,
    o.name as organization_name,
    m.role,
    coalesce((
      select array_agg(distinct effective.permission_code order by effective.permission_code)
      from (
        select rp.permission_code
        from public.identity_role_permissions rp
        where rp.role = m.role
          and not exists (
            select 1
            from public.organization_role_permissions deny_override
            where deny_override.tenant_id = m.tenant_id
              and deny_override.org_id = m.org_id
              and deny_override.role = m.role
              and deny_override.permission_code = rp.permission_code
              and deny_override.allowed = false
          )
        union
        select allow_override.permission_code
        from public.organization_role_permissions allow_override
        where allow_override.tenant_id = m.tenant_id
          and allow_override.org_id = m.org_id
          and allow_override.role = m.role
          and allow_override.allowed = true
      ) effective
    ), array[]::text[]) as permissions
  from public.organization_members m
  join public.organizations o
    on o.id = m.org_id and o.tenant_id = m.tenant_id
  join public.tenants t
    on t.id = m.tenant_id
  where m.user_id = (select auth.uid())
    and m.status = 'active'
    and o.active = true
    and t.status = 'active'
  order by m.created_at asc;
$$;

revoke all on function public.atlas_identity_context() from public, anon;
grant execute on function public.atlas_identity_context() to authenticated;

create index if not exists organization_members_user_created_idx
  on public.organization_members(user_id, created_at, org_id)
  where status = 'active';
