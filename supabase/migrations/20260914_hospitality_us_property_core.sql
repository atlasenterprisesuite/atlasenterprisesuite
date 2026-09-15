create table if not exists public.hospitality_portfolios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  portfolio_key text not null check (length(trim(portfolio_key)) > 0),
  display_name text not null check (length(trim(display_name)) > 0),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, portfolio_key)
);

create table if not exists public.hospitality_brands (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  brand_key text not null check (length(trim(brand_key)) > 0),
  display_name text not null check (length(trim(display_name)) > 0),
  parent_brand_id uuid references public.hospitality_brands(id) on delete set null,
  brand_family text,
  market_segment text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, brand_key)
);

create table if not exists public.hospitality_properties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  portfolio_id uuid references public.hospitality_portfolios(id) on delete set null,
  brand_id uuid references public.hospitality_brands(id) on delete set null,
  property_key text not null check (length(trim(property_key)) > 0),
  display_name text,
  property_type text not null default 'hotel' check (property_type in ('hotel','resort','restaurant','mixed_use','cafe','bar')),
  country_code text not null default 'US' check (length(trim(country_code)) = 2),
  region_code text,
  timezone text,
  currency text not null default 'USD' check (length(trim(currency)) = 3),
  locale text,
  status text not null default 'discovery' check (status in ('discovery','active','inactive','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, property_key)
);

create table if not exists public.hospitality_business_entities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('owner','operator','management_company','franchisor','brand_group','vendor','other')),
  display_name text not null check (length(trim(display_name)) > 0),
  external_reference text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hospitality_property_relationships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  business_entity_id uuid not null references public.hospitality_business_entities(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('owned_by','operated_by','managed_by','franchised_by','branded_by','vendor_for','other')),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.hospitality_departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  code text not null check (length(trim(code)) > 0),
  display_name text not null check (length(trim(display_name)) > 0),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, code)
);

create table if not exists public.hospitality_property_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (length(trim(role)) > 0),
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, user_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.hospitality_department_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_membership_id uuid not null references public.hospitality_property_memberships(id) on delete cascade,
  department_id uuid not null references public.hospitality_departments(id) on delete cascade,
  role text not null default 'member' check (length(trim(role)) > 0),
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_membership_id, department_id)
);

create table if not exists public.hospitality_rooms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  room_key text not null check (length(trim(room_key)) > 0),
  display_label text,
  floor text,
  status text not null default 'active' check (status in ('active','inactive','out_of_order','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, room_key)
);

create index if not exists hospitality_properties_org_status_idx on public.hospitality_properties (org_id, status);
create index if not exists hospitality_departments_property_status_idx on public.hospitality_departments (property_id, status);
create index if not exists hospitality_property_memberships_user_status_idx on public.hospitality_property_memberships (user_id, status, property_id);
create index if not exists hospitality_rooms_property_status_idx on public.hospitality_rooms (property_id, status);

insert into public.hospitality_properties (
  org_id,
  property_key,
  display_name,
  property_type,
  country_code,
  currency,
  status
)
select distinct
  org_id,
  property_id as property_key,
  null::text as display_name,
  'hotel',
  'US',
  'USD',
  'discovery'
from public.hospitality_provider_instances
where length(trim(property_id)) > 0
on conflict (org_id, property_key) do nothing;

alter table public.hospitality_portfolios enable row level security;
alter table public.hospitality_brands enable row level security;
alter table public.hospitality_properties enable row level security;
alter table public.hospitality_business_entities enable row level security;
alter table public.hospitality_property_relationships enable row level security;
alter table public.hospitality_departments enable row level security;
alter table public.hospitality_property_memberships enable row level security;
alter table public.hospitality_department_memberships enable row level security;
alter table public.hospitality_rooms enable row level security;

-- Property reads are allowed to explicit property members or explicitly privileged corporate roles.
drop policy if exists hospitality_properties_member_read on public.hospitality_properties;
create policy hospitality_properties_member_read
on public.hospitality_properties
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = hospitality_properties.org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'platform_admin')
  )
  or exists (
    select 1 from public.hospitality_property_memberships hpm
    where hpm.org_id = hospitality_properties.org_id
      and hpm.property_id = hospitality_properties.id
      and hpm.user_id = auth.uid()
      and hpm.status = 'active'
      and (hpm.starts_at is null or hpm.starts_at <= now())
      and (hpm.ends_at is null or hpm.ends_at > now())
  )
);

-- Members can see their own property membership; corporate admins can see all in their organization.
drop policy if exists hospitality_property_memberships_member_read on public.hospitality_property_memberships;
create policy hospitality_property_memberships_member_read
on public.hospitality_property_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.organization_members om
    where om.org_id = hospitality_property_memberships.org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'platform_admin')
  )
);

-- Department records are property-scoped.
drop policy if exists hospitality_departments_member_read on public.hospitality_departments;
create policy hospitality_departments_member_read
on public.hospitality_departments
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = hospitality_departments.org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'platform_admin')
  )
  or exists (
    select 1 from public.hospitality_property_memberships hpm
    where hpm.org_id = hospitality_departments.org_id
      and hpm.property_id = hospitality_departments.property_id
      and hpm.user_id = auth.uid()
      and hpm.status = 'active'
  )
);

-- Room records are property-scoped.
drop policy if exists hospitality_rooms_member_read on public.hospitality_rooms;
create policy hospitality_rooms_member_read
on public.hospitality_rooms
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = hospitality_rooms.org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'platform_admin')
  )
  or exists (
    select 1 from public.hospitality_property_memberships hpm
    where hpm.org_id = hospitality_rooms.org_id
      and hpm.property_id = hospitality_rooms.property_id
      and hpm.user_id = auth.uid()
      and hpm.status = 'active'
  )
);

-- Department membership is visible only to the member or corporate admins.
drop policy if exists hospitality_department_memberships_member_read on public.hospitality_department_memberships;
create policy hospitality_department_memberships_member_read
on public.hospitality_department_memberships
for select
to authenticated
using (
  exists (
    select 1
    from public.hospitality_property_memberships hpm
    where hpm.id = hospitality_department_memberships.property_membership_id
      and hpm.user_id = auth.uid()
      and hpm.status = 'active'
  )
  or exists (
    select 1 from public.organization_members om
    where om.org_id = hospitality_department_memberships.org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'platform_admin')
  )
);

-- Portfolio/brand/business relationship metadata is limited to active organization members.
-- Property-specific operational records remain protected by property membership policies above.

drop policy if exists hospitality_portfolios_org_read on public.hospitality_portfolios;
create policy hospitality_portfolios_org_read on public.hospitality_portfolios for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_portfolios.org_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists hospitality_brands_org_read on public.hospitality_brands;
create policy hospitality_brands_org_read on public.hospitality_brands for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_brands.org_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists hospitality_business_entities_org_read on public.hospitality_business_entities;
create policy hospitality_business_entities_org_read on public.hospitality_business_entities for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_business_entities.org_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists hospitality_property_relationships_property_read on public.hospitality_property_relationships;
create policy hospitality_property_relationships_property_read on public.hospitality_property_relationships for select to authenticated using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = hospitality_property_relationships.org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'platform_admin')
  )
  or exists (
    select 1 from public.hospitality_property_memberships hpm
    where hpm.org_id = hospitality_property_relationships.org_id
      and hpm.property_id = hospitality_property_relationships.property_id
      and hpm.user_id = auth.uid()
      and hpm.status = 'active'
  )
);

revoke all on public.hospitality_portfolios from authenticated;
revoke all on public.hospitality_brands from authenticated;
revoke all on public.hospitality_properties from authenticated;
revoke all on public.hospitality_business_entities from authenticated;
revoke all on public.hospitality_property_relationships from authenticated;
revoke all on public.hospitality_departments from authenticated;
revoke all on public.hospitality_property_memberships from authenticated;
revoke all on public.hospitality_department_memberships from authenticated;
revoke all on public.hospitality_rooms from authenticated;

grant select on public.hospitality_portfolios to authenticated;
grant select on public.hospitality_brands to authenticated;
grant select on public.hospitality_properties to authenticated;
grant select on public.hospitality_business_entities to authenticated;
grant select on public.hospitality_property_relationships to authenticated;
grant select on public.hospitality_departments to authenticated;
grant select on public.hospitality_property_memberships to authenticated;
grant select on public.hospitality_department_memberships to authenticated;
grant select on public.hospitality_rooms to authenticated;
