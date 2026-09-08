create extension if not exists pgcrypto;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  status text not null default 'active' check (status in ('active','suspended','archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 200),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug),
  unique (id, tenant_id)
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  status text not null default 'active' check (status in ('invited','active','suspended','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade
);

create table public.identity_permissions (
  code text primary key check (code ~ '^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)+$'),
  description text not null,
  created_at timestamptz not null default now()
);

create table public.identity_role_permissions (
  role text not null,
  permission_code text not null references public.identity_permissions(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role, permission_code)
);

create table public.organization_role_permissions (
  tenant_id uuid not null,
  org_id uuid not null,
  role text not null,
  permission_code text not null references public.identity_permissions(code) on delete cascade,
  allowed boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, role, permission_code),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (length(trim(action)) between 1 and 160),
  entity_type text not null check (length(trim(entity_type)) between 1 and 160),
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete restrict
);

create table public.module_registry (
  code text primary key check (code ~ '^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)*$'),
  family text not null,
  display_name text not null,
  status text not null default 'available' check (status in ('available','preview','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_modules (
  tenant_id uuid not null,
  org_id uuid not null,
  module_code text not null references public.module_registry(code) on delete restrict,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, module_code),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade
);

create index organization_members_user_active_idx on public.organization_members(user_id, status, org_id);
create index organization_members_tenant_org_idx on public.organization_members(tenant_id, org_id);
create index organizations_tenant_active_idx on public.organizations(tenant_id, active);
create index audit_logs_scope_created_idx on public.audit_logs(tenant_id, org_id, created_at desc);
create index audit_logs_actor_created_idx on public.audit_logs(actor_id, created_at desc);
create index organization_modules_scope_idx on public.organization_modules(tenant_id, org_id, enabled);

create or replace function public.atlas_is_org_member(p_tenant_id uuid, p_org_id uuid)
returns boolean
language sql
stable
security definer
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
security definer
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
security definer
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

create or replace function public.bootstrap_atlas_tenant(
  p_tenant_name text,
  p_tenant_slug text,
  p_organization_name text,
  p_organization_slug text
)
returns table(tenant_id uuid, organization_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_org_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(coalesce(p_tenant_name,''))) = 0 or length(trim(coalesce(p_organization_name,''))) = 0 then
    raise exception 'Tenant and organization names are required';
  end if;

  if p_tenant_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'
     or p_organization_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'Invalid slug';
  end if;

  insert into public.tenants(name, slug, created_by)
  values (trim(p_tenant_name), p_tenant_slug, v_user_id)
  returning id into v_tenant_id;

  insert into public.organizations(tenant_id, name, slug, created_by)
  values (v_tenant_id, trim(p_organization_name), p_organization_slug, v_user_id)
  returning id into v_org_id;

  insert into public.organization_members(tenant_id, org_id, user_id, role, status)
  values (v_tenant_id, v_org_id, v_user_id, 'owner', 'active');

  insert into public.audit_logs(tenant_id, org_id, actor_id, action, entity_type, entity_id, after_state)
  values (
    v_tenant_id,
    v_org_id,
    v_user_id,
    'tenant.bootstrap',
    'organization',
    v_org_id::text,
    jsonb_build_object('tenant_id', v_tenant_id, 'organization_id', v_org_id, 'role', 'owner')
  );

  return query select v_tenant_id, v_org_id;
end;
$$;

insert into public.identity_permissions(code, description) values
  ('core.read', 'Read ATLAS core context'),
  ('core.admin', 'Administer ATLAS core settings'),
  ('audit.read', 'Read scoped audit history'),
  ('identity.manage', 'Manage identity and role policy'),
  ('organization.manage', 'Manage organization settings'),
  ('members.manage', 'Manage organization membership'),
  ('modules.read', 'Read enabled module state'),
  ('modules.manage', 'Manage enabled modules'),
  ('integrations.manage', 'Manage external integrations'),
  ('security.read', 'Read security posture'),
  ('security.admin', 'Administer security controls');

insert into public.identity_role_permissions(role, permission_code)
select 'owner', code from public.identity_permissions;

insert into public.identity_role_permissions(role, permission_code)
select 'admin', code from public.identity_permissions
where code <> 'core.admin' or true;

insert into public.identity_role_permissions(role, permission_code) values
  ('manager', 'core.read'),
  ('manager', 'audit.read'),
  ('manager', 'modules.read'),
  ('staff', 'core.read'),
  ('staff', 'modules.read'),
  ('viewer', 'core.read'),
  ('viewer', 'modules.read');

insert into public.module_registry(code, family, display_name, status) values
  ('core', 'administration', 'ATLAS Core', 'available'),
  ('finance.accounting', 'finance', 'Accounting', 'preview'),
  ('people', 'people', 'People', 'preview'),
  ('health', 'health', 'ATLAS Health', 'preview'),
  ('mobility.ride', 'mobility', 'ATLAS Ride', 'preview'),
  ('platform.automations', 'platform', 'ATLAS Automations', 'preview'),
  ('platform.site_review', 'platform', 'ATLAS Site Review', 'preview'),
  ('telecom', 'operations', 'ATLAS Telecom', 'preview');

alter table public.tenants enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.identity_permissions enable row level security;
alter table public.identity_role_permissions enable row level security;
alter table public.organization_role_permissions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.module_registry enable row level security;
alter table public.organization_modules enable row level security;

create policy tenants_select_member on public.tenants
for select to authenticated
using (public.atlas_is_tenant_member(id));

create policy organizations_select_member on public.organizations
for select to authenticated
using (public.atlas_is_org_member(tenant_id, id));

create policy organization_members_select_scope on public.organization_members
for select to authenticated
using (public.atlas_is_org_member(tenant_id, org_id));

create policy identity_permissions_read on public.identity_permissions
for select to authenticated
using (true);

create policy identity_role_permissions_read on public.identity_role_permissions
for select to authenticated
using (true);

create policy organization_role_permissions_read_scope on public.organization_role_permissions
for select to authenticated
using (public.atlas_is_org_member(tenant_id, org_id));

create policy audit_logs_read_scope on public.audit_logs
for select to authenticated
using (
  public.atlas_is_org_member(tenant_id, org_id)
  and public.has_identity_permission(tenant_id, org_id, 'audit.read')
);

create policy module_registry_read on public.module_registry
for select to authenticated
using (true);

create policy organization_modules_read_scope on public.organization_modules
for select to authenticated
using (public.atlas_is_org_member(tenant_id, org_id));

revoke all on public.tenants, public.organizations, public.organization_members,
  public.identity_permissions, public.identity_role_permissions,
  public.organization_role_permissions, public.audit_logs,
  public.module_registry, public.organization_modules from anon, authenticated;

grant select on public.tenants, public.organizations, public.organization_members,
  public.identity_permissions, public.identity_role_permissions,
  public.organization_role_permissions, public.audit_logs,
  public.module_registry, public.organization_modules to authenticated;

grant all on public.tenants, public.organizations, public.organization_members,
  public.identity_permissions, public.identity_role_permissions,
  public.organization_role_permissions, public.audit_logs,
  public.module_registry, public.organization_modules to service_role;

revoke all on function public.atlas_is_org_member(uuid, uuid) from public, anon;
revoke all on function public.atlas_is_tenant_member(uuid) from public, anon;
revoke all on function public.has_identity_permission(uuid, uuid, text) from public, anon;
revoke all on function public.bootstrap_atlas_tenant(text, text, text, text) from public, anon;

grant execute on function public.atlas_is_org_member(uuid, uuid) to authenticated;
grant execute on function public.atlas_is_tenant_member(uuid) to authenticated;
grant execute on function public.has_identity_permission(uuid, uuid, text) to authenticated;
grant execute on function public.bootstrap_atlas_tenant(text, text, text, text) to authenticated;
