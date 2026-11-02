-- ATLAS Identity foundation
-- Adds an IAM-style authorization layer on top of Supabase Auth without duplicating passwords or sessions.
begin;

create table if not exists public.identity_permissions (
  code text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.identity_role_permissions (
  role text not null check (role in ('owner','admin','accountant','manager','staff','viewer')),
  permission_code text not null references public.identity_permissions(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role, permission_code)
);

create table if not exists public.organization_role_permissions (
  org_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('owner','admin','accountant','manager','staff','viewer')),
  permission_code text not null references public.identity_permissions(code) on delete cascade,
  allowed boolean not null,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, role, permission_code)
);

create table if not exists public.identity_security_events (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.identity_permissions(code, description) values
  ('core.read', 'Open ATLAS Core and read the authenticated workspace'),
  ('organization.manage', 'Update organization-level settings'),
  ('members.read', 'Read organization memberships'),
  ('members.manage', 'Invite, update, suspend, or remove organization members'),
  ('modules.read', 'Read enabled ATLAS modules'),
  ('modules.manage', 'Enable, disable, or configure ATLAS modules'),
  ('accounting.read', 'Read accounting data'),
  ('accounting.write', 'Create or update accounting data'),
  ('crm.read', 'Read CRM data'),
  ('crm.write', 'Create or update CRM data'),
  ('inventory.read', 'Read inventory data'),
  ('inventory.write', 'Create or update inventory data'),
  ('hr.read', 'Read HR data allowed by organization policy'),
  ('hr.write', 'Create or update HR data allowed by organization policy'),
  ('documents.read', 'Read organization documents'),
  ('documents.write', 'Create or update organization documents'),
  ('audit.read', 'Read organization audit history'),
  ('identity.manage', 'Manage ATLAS Identity policy overrides'),
  ('security.events.read', 'Read identity security events')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions(role, permission_code)
select 'owner', code from public.identity_permissions
on conflict do nothing;

insert into public.identity_role_permissions(role, permission_code)
select 'admin', code from public.identity_permissions
on conflict do nothing;

insert into public.identity_role_permissions(role, permission_code) values
  ('accountant','core.read'),('accountant','members.read'),('accountant','modules.read'),
  ('accountant','accounting.read'),('accountant','accounting.write'),
  ('accountant','crm.read'),('accountant','crm.write'),
  ('accountant','inventory.read'),('accountant','inventory.write'),
  ('accountant','documents.read'),('accountant','documents.write'),('accountant','audit.read'),
  ('manager','core.read'),('manager','members.read'),('manager','modules.read'),
  ('manager','crm.read'),('manager','crm.write'),('manager','inventory.read'),('manager','inventory.write'),
  ('manager','hr.read'),('manager','hr.write'),('manager','documents.read'),('manager','documents.write'),
  ('staff','core.read'),('staff','modules.read'),('staff','crm.read'),('staff','crm.write'),
  ('staff','inventory.read'),('staff','inventory.write'),('staff','documents.read'),('staff','documents.write'),
  ('viewer','core.read'),('viewer','members.read'),('viewer','modules.read'),
  ('viewer','accounting.read'),('viewer','crm.read'),('viewer','inventory.read'),('viewer','documents.read')
on conflict do nothing;

create or replace function public.has_identity_permission(o uuid, p text)
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
        on override.org_id = membership.org_id
       and override.role = membership.role
       and override.permission_code = p
      where membership.org_id = o
        and membership.user_id = auth.uid()
        and membership.status = 'active'
      limit 1
    ),
    exists (
      select 1
      from public.organization_members membership
      join public.identity_role_permissions defaults
        on defaults.role = membership.role
       and defaults.permission_code = p
      where membership.org_id = o
        and membership.user_id = auth.uid()
        and membership.status = 'active'
    ),
    false
  );
$$;

create or replace function public.get_identity_context()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'organizations', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', org.id,
          'name', org.name,
          'legal_name', org.legal_name,
          'industry', org.industry,
          'role', membership.role,
          'permissions', (
            select coalesce(jsonb_agg(permission.code order by permission.code), '[]'::jsonb)
            from public.identity_permissions permission
            where coalesce(
              (
                select override.allowed
                from public.organization_role_permissions override
                where override.org_id = membership.org_id
                  and override.role = membership.role
                  and override.permission_code = permission.code
              ),
              exists (
                select 1
                from public.identity_role_permissions defaults
                where defaults.role = membership.role
                  and defaults.permission_code = permission.code
              ),
              false
            )
          ),
          'modules', (
            select coalesce(jsonb_agg(module.module_code order by module.module_code), '[]'::jsonb)
            from public.organization_modules module
            where module.org_id = membership.org_id
              and module.enabled = true
          )
        ) order by org.name
      ),
      '[]'::jsonb
    )
  )
  from public.organization_members membership
  join public.organizations org on org.id = membership.org_id
  where membership.user_id = auth.uid()
    and membership.status = 'active'
    and org.active = true;
$$;

create or replace function public.set_identity_role_permission(
  organization_id uuid,
  target_role text,
  target_permission text,
  allow_permission boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_org_role(organization_id, array['owner','admin']) then
    raise exception 'Identity administration permission required';
  end if;

  if target_role not in ('owner','admin','accountant','manager','staff','viewer') then
    raise exception 'Unsupported organization role';
  end if;

  if not exists (select 1 from public.identity_permissions where code = target_permission) then
    raise exception 'Unknown identity permission';
  end if;

  insert into public.organization_role_permissions(org_id, role, permission_code, allowed, updated_by)
  values (organization_id, target_role, target_permission, allow_permission, auth.uid())
  on conflict (org_id, role, permission_code)
  do update set allowed = excluded.allowed, updated_by = auth.uid(), updated_at = now();

  insert into public.identity_security_events(org_id, actor_user_id, event_type, metadata)
  values (
    organization_id,
    auth.uid(),
    'role_permission_changed',
    jsonb_build_object('role', target_role, 'permission', target_permission, 'allowed', allow_permission)
  );
end;
$$;

alter table public.identity_permissions enable row level security;
alter table public.identity_role_permissions enable row level security;
alter table public.organization_role_permissions enable row level security;
alter table public.identity_security_events enable row level security;

create policy identity_permissions_read on public.identity_permissions
for select to authenticated using (true);

create policy identity_role_permissions_read on public.identity_role_permissions
for select to authenticated using (true);

create policy organization_role_permissions_read on public.organization_role_permissions
for select to authenticated using (public.is_org_member(org_id));

create policy organization_role_permissions_manage on public.organization_role_permissions
for all to authenticated
using (public.has_org_role(org_id, array['owner','admin']))
with check (public.has_org_role(org_id, array['owner','admin']));

create policy identity_security_events_read on public.identity_security_events
for select to authenticated
using (org_id is not null and public.has_org_role(org_id, array['owner','admin']));

revoke insert, update, delete on public.identity_permissions from authenticated;
revoke insert, update, delete on public.identity_role_permissions from authenticated;
revoke insert, update, delete on public.identity_security_events from authenticated;

grant select on public.identity_permissions to authenticated;
grant select on public.identity_role_permissions to authenticated;
grant select, insert, update, delete on public.organization_role_permissions to authenticated;
grant select on public.identity_security_events to authenticated;

revoke execute on function public.has_identity_permission(uuid,text) from public, anon;
revoke execute on function public.get_identity_context() from public, anon;
revoke execute on function public.set_identity_role_permission(uuid,text,text,boolean) from public, anon;
grant execute on function public.has_identity_permission(uuid,text) to authenticated;
grant execute on function public.get_identity_context() to authenticated;
grant execute on function public.set_identity_role_permission(uuid,text,text,boolean) to authenticated;

commit;
