create table if not exists public.hospitality_sla_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.hospitality_properties(id) on delete cascade,
  scope_type text not null check (scope_type in ('brand','portfolio','property','request_category')),
  scope_reference text not null check (length(trim(scope_reference)) > 0),
  request_category text,
  response_minutes integer not null check (response_minutes >= 0),
  resolution_minutes integer not null check (resolution_minutes > 0 and resolution_minutes >= response_minutes),
  warning_minutes_before_breach integer not null default 0 check (warning_minutes_before_breach >= 0 and warning_minutes_before_breach <= resolution_minutes),
  version integer not null default 1 check (version > 0),
  status text not null default 'active' check (status in ('draft','active','inactive')),
  effective_from timestamptz,
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_from is null or effective_until > effective_from)
);

create table if not exists public.hospitality_service_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  department_id uuid references public.hospitality_departments(id) on delete set null,
  room_id uuid references public.hospitality_rooms(id) on delete set null,
  guest_reference text,
  request_type text not null check (length(trim(request_type)) > 0),
  category text not null check (length(trim(category)) > 0),
  source text not null check (source in ('front_desk','guest_qr','guest_web','mobile_app','employee','phone_transcription','assistant','integration','event_workflow','automatic_rule')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  business_status text not null default 'new' check (business_status in ('new','queued','assigned','accepted','in_progress','waiting','blocked','escalated','completed','verified','cancelled','failed')),
  summary text not null check (length(trim(summary)) > 0),
  details text,
  assigned_user_id uuid,
  sla_policy_id uuid references public.hospitality_sla_policies(id) on delete set null,
  execution_workflow_id text,
  requested_at timestamptz not null default now(),
  assigned_at timestamptz,
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  verified_at timestamptz,
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  escalation_due_at timestamptz,
  blocked_reason text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hospitality_service_requests_property_status_idx
  on public.hospitality_service_requests (property_id, business_status, priority, requested_at desc);
create index if not exists hospitality_service_requests_department_status_idx
  on public.hospitality_service_requests (department_id, business_status, requested_at desc);
create index if not exists hospitality_sla_policies_scope_idx
  on public.hospitality_sla_policies (org_id, property_id, scope_type, status);

alter table public.hospitality_sla_policies enable row level security;
alter table public.hospitality_service_requests enable row level security;

drop policy if exists hospitality_service_requests_property_read on public.hospitality_service_requests;
create policy hospitality_service_requests_property_read
on public.hospitality_service_requests
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = hospitality_service_requests.org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner','admin','platform_admin')
  )
  or exists (
    select 1 from public.hospitality_property_memberships hpm
    where hpm.org_id = hospitality_service_requests.org_id
      and hpm.property_id = hospitality_service_requests.property_id
      and hpm.user_id = auth.uid()
      and hpm.status = 'active'
  )
);

drop policy if exists hospitality_sla_policies_property_read on public.hospitality_sla_policies;
create policy hospitality_sla_policies_property_read
on public.hospitality_sla_policies
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = hospitality_sla_policies.org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner','admin','platform_admin')
  )
  or (
    property_id is not null and exists (
      select 1 from public.hospitality_property_memberships hpm
      where hpm.org_id = hospitality_sla_policies.org_id
        and hpm.property_id = hospitality_sla_policies.property_id
        and hpm.user_id = auth.uid()
        and hpm.status = 'active'
    )
  )
);

revoke all on public.hospitality_sla_policies from authenticated;
revoke all on public.hospitality_service_requests from authenticated;
grant select on public.hospitality_sla_policies to authenticated;
grant select on public.hospitality_service_requests to authenticated;
