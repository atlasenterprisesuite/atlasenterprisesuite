create table if not exists public.atlas_workflows (
  id uuid primary key default gen_random_uuid(),
  task_id text not null check (length(trim(task_id)) > 0),
  workflow_type text not null check (length(trim(workflow_type)) > 0),
  module text not null check (length(trim(module)) > 0),
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  org_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null,
  status text not null default 'next' check (status in ('now','next','blocked','awaiting_approval','completed','failed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  current_step text,
  next_action text,
  dependencies text[] not null default '{}'::text[],
  blocked_reason text,
  permissions_required text[] not null default '{}'::text[],
  trace_id uuid not null default gen_random_uuid(),
  completion_policy jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, task_id)
);

create table if not exists public.atlas_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  task_id text not null,
  step_id text not null check (length(trim(step_id)) > 0),
  module text not null check (length(trim(module)) > 0),
  action_type text not null check (length(trim(action_type)) > 0),
  execution_class text not null check (execution_class in ('observe','prepare','execute','validate')),
  status text not null default 'pending' check (status in ('pending','ready','running','blocked','awaiting_approval','completed','failed','cancelled')),
  dependencies text[] not null default '{}'::text[],
  permissions_required text[] not null default '{}'::text[],
  approval_policy text not null default 'policy' check (approval_policy in ('none','policy','explicit')),
  retry_policy jsonb not null default '{"maxAttempts":1,"backoffMs":0}'::jsonb,
  timeout_ms integer not null default 30000 check (timeout_ms > 0),
  idempotency_key text,
  input_refs text[] not null default '{}'::text[],
  result_refs text[] not null default '{}'::text[],
  evidence_requirements jsonb not null default '[]'::jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, task_id, step_id),
  foreign key (org_id, task_id) references public.atlas_workflows(org_id, task_id) on delete cascade
);

create table if not exists public.atlas_workflow_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  task_id text not null,
  step_id text,
  trace_id uuid not null,
  actor_id uuid not null,
  event_type text not null check (length(trim(event_type)) > 0),
  authorization_result text,
  approval_state text,
  result_state text,
  evidence_refs text[] not null default '{}'::text[],
  error_category text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (org_id, task_id) references public.atlas_workflows(org_id, task_id) on delete cascade
);

create table if not exists public.atlas_approval_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  task_id text not null,
  step_id text,
  module text not null check (length(trim(module)) > 0),
  requested_by uuid not null,
  action_summary text not null check (length(trim(action_summary)) > 0),
  risk_class text not null check (risk_class in ('low','moderate','high','regulated')),
  permissions_requested text[] not null default '{}'::text[],
  intended_external_effect text,
  target_reference text,
  proposed_values jsonb not null default '{}'::jsonb,
  evidence_ids uuid[] not null default '{}'::uuid[],
  expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','denied','cancelled','expired')),
  approver_id uuid,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, task_id) references public.atlas_workflows(org_id, task_id) on delete cascade
);

create table if not exists public.atlas_evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  task_id text not null,
  step_id text,
  evidence_type text not null check (length(trim(evidence_type)) > 0),
  source_type text not null check (length(trim(source_type)) > 0),
  source_reference text,
  immutable_digest text,
  verification_state text not null default 'unverified' check (verification_state in ('unverified','verified','rejected')),
  produced_by uuid,
  verified_by uuid,
  verified_at timestamptz,
  visibility_scope text not null default 'organization' check (visibility_scope in ('private','organization')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (org_id, task_id) references public.atlas_workflows(org_id, task_id) on delete cascade
);

create table if not exists public.atlas_provider_registry (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider_key text not null check (length(trim(provider_key)) > 0),
  display_name text not null check (length(trim(display_name)) > 0),
  state text not null default 'not_configured' check (state in ('not_configured','configured_unverified','probing','verified','degraded','unavailable')),
  capabilities text[] not null default '{}'::text[],
  models_services jsonb not null default '[]'::jsonb,
  secret_requirements text[] not null default '{}'::text[],
  region_constraints text[] not null default '{}'::text[],
  rate_limit_metadata jsonb not null default '{}'::jsonb,
  cost_metadata jsonb not null default '{}'::jsonb,
  last_probe_at timestamptz,
  last_verified_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider_key)
);

create table if not exists public.atlas_provider_probes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider_id uuid not null references public.atlas_provider_registry(id) on delete cascade,
  capability text,
  state text not null check (state in ('not_configured','configured_unverified','probing','verified','degraded','unavailable')),
  verified boolean not null default false,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create table if not exists public.atlas_usage_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  task_id text,
  step_id text,
  user_id uuid not null,
  provider_id uuid references public.atlas_provider_registry(id) on delete set null,
  provider_key text,
  model_service text,
  capability text not null check (length(trim(capability)) > 0),
  unit_usage numeric not null default 0 check (unit_usage >= 0),
  estimated_cost numeric not null default 0 check (estimated_cost >= 0),
  actual_cost numeric check (actual_cost is null or actual_cost >= 0),
  currency text not null default 'USD',
  budget_decision text not null check (budget_decision in ('allowed','approval_required','budget_blocked')),
  approval_id uuid references public.atlas_approval_requests(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_document_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  task_id text,
  storage_reference text not null check (length(trim(storage_reference)) > 0),
  document_type text not null check (length(trim(document_type)) > 0),
  sensitivity_class text not null default 'sensitive' check (sensitivity_class in ('internal','confidential','sensitive','regulated')),
  checksum text,
  retention_until timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_document_fields (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_document_id uuid not null references public.atlas_document_sources(id) on delete cascade,
  field_key text not null check (length(trim(field_key)) > 0),
  original_value text,
  normalized_value jsonb,
  source_page integer check (source_page is null or source_page > 0),
  source_region text,
  extractor text not null check (length(trim(extractor)) > 0),
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  verification_state text not null default 'unverified' check (verification_state in ('unverified','machine_checked','human_verified','rejected')),
  corrected_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists atlas_workflows_org_status_owner_idx on public.atlas_workflows (org_id, status, owner_id);
create index if not exists atlas_workflow_steps_task_status_idx on public.atlas_workflow_steps (org_id, task_id, status);
create index if not exists atlas_approval_requests_org_status_idx on public.atlas_approval_requests (org_id, status, created_at);
create index if not exists atlas_evidence_workflow_idx on public.atlas_evidence (org_id, task_id, step_id, verification_state);
create index if not exists atlas_provider_registry_org_state_idx on public.atlas_provider_registry (org_id, state);
create index if not exists atlas_usage_events_org_created_idx on public.atlas_usage_events (org_id, created_at desc);
create index if not exists atlas_document_fields_source_idx on public.atlas_document_fields (org_id, source_document_id, field_key);

alter table public.atlas_workflows enable row level security;
alter table public.atlas_workflow_steps enable row level security;
alter table public.atlas_workflow_events enable row level security;
alter table public.atlas_approval_requests enable row level security;
alter table public.atlas_evidence enable row level security;
alter table public.atlas_provider_registry enable row level security;
alter table public.atlas_provider_probes enable row level security;
alter table public.atlas_usage_events enable row level security;
alter table public.atlas_document_sources enable row level security;
alter table public.atlas_document_fields enable row level security;

revoke all on public.atlas_workflows from authenticated;
revoke all on public.atlas_workflow_steps from authenticated;
revoke all on public.atlas_workflow_events from authenticated;
revoke all on public.atlas_approval_requests from authenticated;
revoke all on public.atlas_evidence from authenticated;
revoke all on public.atlas_provider_registry from authenticated;
revoke all on public.atlas_provider_probes from authenticated;
revoke all on public.atlas_usage_events from authenticated;
revoke all on public.atlas_document_sources from authenticated;
revoke all on public.atlas_document_fields from authenticated;

grant select on public.atlas_workflows to authenticated;
grant select on public.atlas_workflow_steps to authenticated;
grant select on public.atlas_workflow_events to authenticated;
grant select on public.atlas_approval_requests to authenticated;
grant select on public.atlas_evidence to authenticated;
grant select on public.atlas_provider_registry to authenticated;
grant select on public.atlas_provider_probes to authenticated;
grant select on public.atlas_usage_events to authenticated;
grant select on public.atlas_document_sources to authenticated;
grant select on public.atlas_document_fields to authenticated;

drop policy if exists atlas_workflows_member_read on public.atlas_workflows;
create policy atlas_workflows_member_read on public.atlas_workflows for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = atlas_workflows.org_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists atlas_workflow_steps_member_read on public.atlas_workflow_steps;
create policy atlas_workflow_steps_member_read on public.atlas_workflow_steps for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = atlas_workflow_steps.org_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists atlas_workflow_events_member_read on public.atlas_workflow_events;
create policy atlas_workflow_events_member_read on public.atlas_workflow_events for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = atlas_workflow_events.org_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists atlas_approval_requests_member_read on public.atlas_approval_requests;
create policy atlas_approval_requests_member_read on public.atlas_approval_requests for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = atlas_approval_requests.org_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists atlas_evidence_member_read on public.atlas_evidence;
create policy atlas_evidence_member_read on public.atlas_evidence for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = atlas_evidence.org_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists atlas_provider_registry_member_read on public.atlas_provider_registry;
create policy atlas_provider_registry_member_read on public.atlas_provider_registry for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = atlas_provider_registry.org_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists atlas_provider_probes_member_read on public.atlas_provider_probes;
create policy atlas_provider_probes_member_read on public.atlas_provider_probes for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = atlas_provider_probes.org_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists atlas_usage_events_member_read on public.atlas_usage_events;
create policy atlas_usage_events_member_read on public.atlas_usage_events for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = atlas_usage_events.org_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists atlas_document_sources_member_read on public.atlas_document_sources;
create policy atlas_document_sources_member_read on public.atlas_document_sources for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = atlas_document_sources.org_id and om.user_id = auth.uid() and om.status = 'active')
);

drop policy if exists atlas_document_fields_member_read on public.atlas_document_fields;
create policy atlas_document_fields_member_read on public.atlas_document_fields for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = atlas_document_fields.org_id and om.user_id = auth.uid() and om.status = 'active')
);

comment on table public.atlas_workflow_events is 'Append-only redacted execution event metadata. Secrets and raw sensitive payloads are forbidden.';
comment on table public.atlas_evidence is 'Execution evidence metadata and secure references; raw regulated payloads remain in restricted storage.';
comment on table public.atlas_provider_registry is 'Provider readiness metadata only. Provider credentials are not persisted here.';
comment on table public.atlas_document_sources is 'Restricted document source references and retention metadata; access must be audited by server-side services.';
