-- ATLAS Business Analytics canonical persistence, lineage and fail-closed metric foundation.

insert into public.identity_permissions (code, description)
values
  ('analytics.read', 'Read organization-scoped analytics definitions, sources, observations and dashboards.'),
  ('analytics.manage', 'Manage organization-scoped analytics definitions, verified sources, observations and dashboards.'),
  ('analytics.export', 'Export analytics results already authorized for the current organization.'),
  ('analytics.admin', 'Administer ATLAS Business Analytics for an organization.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'analytics.read'),
  ('owner', 'analytics.manage'),
  ('owner', 'analytics.export'),
  ('owner', 'analytics.admin'),
  ('admin', 'analytics.read'),
  ('admin', 'analytics.manage'),
  ('admin', 'analytics.export'),
  ('admin', 'analytics.admin')
on conflict do nothing;

create table if not exists public.analytics_source_registry (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_key text not null,
  module text not null,
  route text not null,
  source_kind text not null check (source_kind in ('internal','external','demo')),
  source_state text not null default 'verification_required'
    check (source_state in ('verification_required','verified','degraded','revoked','contract_gated')),
  verification_evidence jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  last_observed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, source_key),
  check (
    source_state <> 'verified'
    or (
      source_kind <> 'demo'
      and verified_at is not null
      and verified_by is not null
      and verification_evidence <> '{}'::jsonb
    )
  )
);

create table if not exists public.analytics_metric_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  metric_key text not null,
  name text not null,
  category text not null,
  description text not null,
  unit text not null check (unit in ('currency','percent','count','days','ratio','duration')),
  definition_version integer not null default 1 check (definition_version > 0),
  required_source_keys text[] not null default '{}'::text[],
  semantic_contract jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','retired')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, metric_key, definition_version)
);

create table if not exists public.analytics_observations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  metric_id uuid not null references public.analytics_metric_definitions(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  dimensions jsonb not null default '{}'::jsonb,
  numeric_value numeric,
  text_value text,
  currency_code text,
  evidence_scope text not null check (evidence_scope in ('production','demo')),
  source_verified boolean not null default false,
  lineage jsonb not null,
  quality jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (period_end > period_start),
  check ((numeric_value is null) <> (text_value is null)),
  check (evidence_scope <> 'production' or source_verified = true),
  check (jsonb_typeof(lineage) = 'object' and lineage <> '{}'::jsonb)
);

create table if not exists public.analytics_dashboard_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  layout jsonb not null default '[]'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_alert_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  metric_id uuid not null references public.analytics_metric_definitions(id) on delete cascade,
  name text not null,
  comparator text not null check (comparator in ('gt','gte','lt','lte','eq','neq')),
  threshold numeric not null,
  status text not null default 'disabled' check (status in ('disabled','enabled')),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_analytics_sources_org_state on public.analytics_source_registry(org_id, source_state);
create index if not exists idx_analytics_metrics_org_status on public.analytics_metric_definitions(org_id, status);
create index if not exists idx_analytics_observations_metric_period on public.analytics_observations(org_id, metric_id, period_end desc);
create index if not exists idx_analytics_dashboards_org_status on public.analytics_dashboard_definitions(org_id, status);
create index if not exists idx_analytics_alert_rules_org_status on public.analytics_alert_rules(org_id, status);

alter table public.analytics_source_registry enable row level security;
alter table public.analytics_metric_definitions enable row level security;
alter table public.analytics_observations enable row level security;
alter table public.analytics_dashboard_definitions enable row level security;
alter table public.analytics_alert_rules enable row level security;

revoke all on public.analytics_source_registry from anon, authenticated;
revoke all on public.analytics_metric_definitions from anon, authenticated;
revoke all on public.analytics_observations from anon, authenticated;
revoke all on public.analytics_dashboard_definitions from anon, authenticated;
revoke all on public.analytics_alert_rules from anon, authenticated;

grant select, insert, update, delete on public.analytics_source_registry to authenticated;
grant select, insert, update, delete on public.analytics_metric_definitions to authenticated;
grant select, insert, update, delete on public.analytics_observations to authenticated;
grant select, insert, update, delete on public.analytics_dashboard_definitions to authenticated;
grant select, insert, update, delete on public.analytics_alert_rules to authenticated;

drop policy if exists analytics_sources_read on public.analytics_source_registry;
create policy analytics_sources_read on public.analytics_source_registry
for select to authenticated
using (
  public.has_identity_permission(org_id,'analytics.read')
  or public.has_identity_permission(org_id,'analytics.manage')
  or public.has_identity_permission(org_id,'analytics.admin')
);

drop policy if exists analytics_sources_manage on public.analytics_source_registry;
create policy analytics_sources_manage on public.analytics_source_registry
for all to authenticated
using (
  public.has_identity_permission(org_id,'analytics.manage')
  or public.has_identity_permission(org_id,'analytics.admin')
)
with check (
  public.has_identity_permission(org_id,'analytics.manage')
  or public.has_identity_permission(org_id,'analytics.admin')
);

drop policy if exists analytics_metrics_read on public.analytics_metric_definitions;
create policy analytics_metrics_read on public.analytics_metric_definitions
for select to authenticated
using (
  public.has_identity_permission(org_id,'analytics.read')
  or public.has_identity_permission(org_id,'analytics.manage')
  or public.has_identity_permission(org_id,'analytics.admin')
);

drop policy if exists analytics_metrics_manage on public.analytics_metric_definitions;
create policy analytics_metrics_manage on public.analytics_metric_definitions
for all to authenticated
using (
  public.has_identity_permission(org_id,'analytics.manage')
  or public.has_identity_permission(org_id,'analytics.admin')
)
with check (
  public.has_identity_permission(org_id,'analytics.manage')
  or public.has_identity_permission(org_id,'analytics.admin')
);

drop policy if exists analytics_observations_read on public.analytics_observations;
create policy analytics_observations_read on public.analytics_observations
for select to authenticated
using (
  public.has_identity_permission(org_id,'analytics.read')
  or public.has_identity_permission(org_id,'analytics.manage')
  or public.has_identity_permission(org_id,'analytics.admin')
);

drop policy if exists analytics_observations_manage on public.analytics_observations;
create policy analytics_observations_manage on public.analytics_observations
for all to authenticated
using (
  public.has_identity_permission(org_id,'analytics.manage')
  or public.has_identity_permission(org_id,'analytics.admin')
)
with check (
  public.has_identity_permission(org_id,'analytics.manage')
  or public.has_identity_permission(org_id,'analytics.admin')
);

drop policy if exists analytics_dashboards_read on public.analytics_dashboard_definitions;
create policy analytics_dashboards_read on public.analytics_dashboard_definitions
for select to authenticated
using (
  public.has_identity_permission(org_id,'analytics.read')
  or public.has_identity_permission(org_id,'analytics.manage')
  or public.has_identity_permission(org_id,'analytics.admin')
);

drop policy if exists analytics_dashboards_manage on public.analytics_dashboard_definitions;
create policy analytics_dashboards_manage on public.analytics_dashboard_definitions
for all to authenticated
using (
  public.has_identity_permission(org_id,'analytics.manage')
  or public.has_identity_permission(org_id,'analytics.admin')
)
with check (
  public.has_identity_permission(org_id,'analytics.manage')
  or public.has_identity_permission(org_id,'analytics.admin')
);

drop policy if exists analytics_alerts_read on public.analytics_alert_rules;
create policy analytics_alerts_read on public.analytics_alert_rules
for select to authenticated
using (
  public.has_identity_permission(org_id,'analytics.read')
  or public.has_identity_permission(org_id,'analytics.manage')
  or public.has_identity_permission(org_id,'analytics.admin')
);

drop policy if exists analytics_alerts_manage on public.analytics_alert_rules;
create policy analytics_alerts_manage on public.analytics_alert_rules
for all to authenticated
using (
  public.has_identity_permission(org_id,'analytics.manage')
  or public.has_identity_permission(org_id,'analytics.admin')
)
with check (
  public.has_identity_permission(org_id,'analytics.manage')
  or public.has_identity_permission(org_id,'analytics.admin')
);
