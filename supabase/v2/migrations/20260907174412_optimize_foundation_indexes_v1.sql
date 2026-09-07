create index audit_logs_org_tenant_idx on public.audit_logs(org_id, tenant_id);
create index identity_role_permissions_permission_idx on public.identity_role_permissions(permission_code);
create index organization_members_org_tenant_idx on public.organization_members(org_id, tenant_id);
create index organization_modules_module_idx on public.organization_modules(module_code);
create index organization_modules_org_tenant_idx on public.organization_modules(org_id, tenant_id);
create index organization_role_permissions_org_tenant_idx on public.organization_role_permissions(org_id, tenant_id);
create index organization_role_permissions_permission_idx on public.organization_role_permissions(permission_code);
create index organizations_created_by_idx on public.organizations(created_by);
create index tenants_created_by_idx on public.tenants(created_by);

drop policy if exists organization_members_select_self on public.organization_members;
create policy organization_members_select_self on public.organization_members
for select to authenticated
using (user_id = (select auth.uid()));
