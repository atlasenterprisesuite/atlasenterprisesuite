create table if not exists public.hospitality_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  external_event_reference text,
  customer_reference text,
  event_type text not null check (length(trim(event_type)) > 0),
  title text not null check (length(trim(title)) > 0),
  business_status text not null default 'inquiry' check (business_status in ('inquiry','tentative','confirmed','planning','ready','in_progress','completed','closed','cancelled','postponed','on_hold')),
  starts_at timestamptz,
  ends_at timestamptz,
  expected_attendance integer check (expected_attendance is null or expected_attendance >= 0),
  actual_attendance integer check (actual_attendance is null or actual_attendance >= 0),
  venue_reference text,
  execution_workflow_id text,
  source_system text,
  financial_handoff_reference text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.hospitality_event_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  event_id uuid not null references public.hospitality_events(id) on delete cascade,
  version integer not null check (version > 0),
  source_reference text,
  status text not null default 'draft' check (status in ('draft','approved','superseded','cancelled')),
  effective_at timestamptz,
  supersedes_id uuid references public.hospitality_event_orders(id) on delete set null,
  structured_order jsonb not null default '{}'::jsonb,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, version)
);

create table if not exists public.hospitality_event_changes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  event_id uuid not null references public.hospitality_events(id) on delete cascade,
  event_order_id uuid references public.hospitality_event_orders(id) on delete set null,
  change_type text not null check (length(trim(change_type)) > 0),
  previous_value jsonb,
  new_value jsonb,
  impact_level text not null check (impact_level in ('low','medium','high','critical','review')),
  affected_domains text[] not null default '{}'::text[],
  requested_by uuid not null,
  approved_by uuid,
  effective_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.hospitality_event_timeline_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  event_id uuid not null references public.hospitality_events(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  starts_at timestamptz not null,
  ends_at timestamptz,
  title text not null check (length(trim(title)) > 0),
  department_id uuid references public.hospitality_departments(id) on delete set null,
  owner_user_id uuid,
  status text not null default 'pending' check (status in ('pending','ready','in_progress','blocked','completed','cancelled')),
  execution_step_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, sequence),
  check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.hospitality_event_vendor_requirements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  event_id uuid not null references public.hospitality_events(id) on delete cascade,
  vendor_reference text not null check (length(trim(vendor_reference)) > 0),
  service_type text not null check (length(trim(service_type)) > 0),
  arrival_window_start timestamptz,
  arrival_window_end timestamptz,
  insurance_reference_status text,
  setup_requirements text,
  contact_reference text,
  approval_state text not null default 'pending' check (approval_state in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (arrival_window_end is null or arrival_window_start is null or arrival_window_end > arrival_window_start)
);

create index if not exists hospitality_events_property_status_time_idx on public.hospitality_events (property_id, business_status, starts_at);
create index if not exists hospitality_event_orders_event_version_idx on public.hospitality_event_orders (event_id, version desc);
create index if not exists hospitality_event_changes_event_time_idx on public.hospitality_event_changes (event_id, created_at desc);

alter table public.hospitality_events enable row level security;
alter table public.hospitality_event_orders enable row level security;
alter table public.hospitality_event_changes enable row level security;
alter table public.hospitality_event_timeline_items enable row level security;
alter table public.hospitality_event_vendor_requirements enable row level security;

-- Event records are property-scoped. Mutations remain behind governed server-side operations.
drop policy if exists hospitality_events_property_read on public.hospitality_events;
create policy hospitality_events_property_read on public.hospitality_events for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_events.org_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner','admin','platform_admin'))
  or exists (select 1 from public.hospitality_property_memberships hpm where hpm.org_id = hospitality_events.org_id and hpm.property_id = hospitality_events.property_id and hpm.user_id = auth.uid() and hpm.status = 'active')
);

create policy hospitality_event_orders_property_read on public.hospitality_event_orders for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_event_orders.org_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner','admin','platform_admin'))
  or exists (select 1 from public.hospitality_property_memberships hpm where hpm.org_id = hospitality_event_orders.org_id and hpm.property_id = hospitality_event_orders.property_id and hpm.user_id = auth.uid() and hpm.status = 'active')
);

create policy hospitality_event_changes_property_read on public.hospitality_event_changes for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_event_changes.org_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner','admin','platform_admin'))
  or exists (select 1 from public.hospitality_property_memberships hpm where hpm.org_id = hospitality_event_changes.org_id and hpm.property_id = hospitality_event_changes.property_id and hpm.user_id = auth.uid() and hpm.status = 'active')
);

create policy hospitality_event_timeline_items_property_read on public.hospitality_event_timeline_items for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_event_timeline_items.org_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner','admin','platform_admin'))
  or exists (select 1 from public.hospitality_property_memberships hpm where hpm.org_id = hospitality_event_timeline_items.org_id and hpm.property_id = hospitality_event_timeline_items.property_id and hpm.user_id = auth.uid() and hpm.status = 'active')
);

create policy hospitality_event_vendor_requirements_property_read on public.hospitality_event_vendor_requirements for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_event_vendor_requirements.org_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner','admin','platform_admin'))
  or exists (select 1 from public.hospitality_property_memberships hpm where hpm.org_id = hospitality_event_vendor_requirements.org_id and hpm.property_id = hospitality_event_vendor_requirements.property_id and hpm.user_id = auth.uid() and hpm.status = 'active')
);

revoke all on public.hospitality_events from authenticated;
revoke all on public.hospitality_event_orders from authenticated;
revoke all on public.hospitality_event_changes from authenticated;
revoke all on public.hospitality_event_timeline_items from authenticated;
revoke all on public.hospitality_event_vendor_requirements from authenticated;
grant select on public.hospitality_events to authenticated;
grant select on public.hospitality_event_orders to authenticated;
grant select on public.hospitality_event_changes to authenticated;
grant select on public.hospitality_event_timeline_items to authenticated;
grant select on public.hospitality_event_vendor_requirements to authenticated;
