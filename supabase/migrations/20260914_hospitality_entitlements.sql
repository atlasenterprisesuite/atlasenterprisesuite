create table if not exists public.hospitality_stay_contexts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  external_stay_reference text not null check (length(trim(external_stay_reference)) > 0),
  external_guest_reference text,
  room_id uuid references public.hospitality_rooms(id) on delete set null,
  arrival_at timestamptz,
  departure_at timestamptz,
  rate_plan_reference text,
  package_reference text,
  group_reference text,
  loyalty_reference text,
  loyalty_tier_reference text,
  reservation_status text not null default 'unknown',
  source_system text not null check (length(trim(source_system)) > 0),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, source_system, external_stay_reference),
  check (departure_at is null or arrival_at is null or departure_at > arrival_at)
);

create table if not exists public.hospitality_entitlement_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.hospitality_properties(id) on delete cascade,
  entitlement_key text not null check (length(trim(entitlement_key)) > 0),
  display_name text not null check (length(trim(display_name)) > 0),
  category text not null check (length(trim(category)) > 0),
  unit_type text not null check (unit_type in ('per_stay','per_night','per_day','per_guest','per_room','fixed_quantity','monetary_balance','unlimited','single_use')),
  default_quantity numeric,
  monetary_limit numeric,
  currency text,
  valid_from timestamptz,
  valid_until timestamptz,
  status text not null default 'active' check (status in ('draft','active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (monetary_limit is null or monetary_limit >= 0),
  check (default_quantity is null or default_quantity >= 0),
  check (valid_until is null or valid_from is null or valid_until > valid_from)
);

create table if not exists public.hospitality_entitlement_rule_sets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.hospitality_properties(id) on delete cascade,
  scope_type text not null check (scope_type in ('system','brand','portfolio','property','stay')),
  scope_reference text not null check (length(trim(scope_reference)) > 0),
  name text not null check (length(trim(name)) > 0),
  version integer not null check (version > 0),
  effective_from timestamptz,
  effective_until timestamptz,
  status text not null default 'draft' check (status in ('draft','active','inactive')),
  created_by uuid not null,
  approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, scope_type, scope_reference, name, version)
);

create table if not exists public.hospitality_entitlement_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rule_set_id uuid not null references public.hospitality_entitlement_rule_sets(id) on delete cascade,
  entitlement_definition_id uuid not null references public.hospitality_entitlement_definitions(id) on delete cascade,
  sequence integer not null default 1 check (sequence > 0),
  conditions jsonb not null default '{}'::jsonb,
  decision text not null check (decision in ('eligible','not_eligible','manual_review')),
  reason_code text not null check (length(trim(reason_code)) > 0),
  quantity numeric,
  monetary_amount numeric,
  currency text,
  created_at timestamptz not null default now(),
  check (quantity is null or quantity >= 0),
  check (monetary_amount is null or monetary_amount >= 0)
);

create table if not exists public.hospitality_entitlement_decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  stay_context_id uuid not null references public.hospitality_stay_contexts(id) on delete cascade,
  entitlement_definition_id uuid not null references public.hospitality_entitlement_definitions(id) on delete restrict,
  decision text not null check (decision in ('eligible','not_eligible','manual_review','source_unavailable','expired','invalid_context','error')),
  quantity_authorized numeric,
  monetary_amount_authorized numeric,
  currency text,
  valid_from timestamptz,
  valid_until timestamptz,
  rule_set_id uuid references public.hospitality_entitlement_rule_sets(id) on delete set null,
  rule_set_version integer not null,
  source_reference text,
  reason_code text not null check (length(trim(reason_code)) > 0),
  requires_manual_review boolean not null default false,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (quantity_authorized is null or quantity_authorized >= 0),
  check (monetary_amount_authorized is null or monetary_amount_authorized >= 0)
);

create table if not exists public.hospitality_entitlement_redemptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  decision_id uuid not null references public.hospitality_entitlement_decisions(id) on delete restrict,
  entitlement_definition_id uuid not null references public.hospitality_entitlement_definitions(id) on delete restrict,
  stay_context_id uuid not null references public.hospitality_stay_contexts(id) on delete cascade,
  quantity numeric,
  monetary_amount numeric,
  currency text,
  redemption_location text,
  source_system text,
  external_transaction_reference text,
  redeemed_by uuid,
  redeemed_at timestamptz not null default now(),
  status text not null check (status in ('reserved','redeemed','partially_redeemed','reversed','voided','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity is null or quantity >= 0),
  check (monetary_amount is null or monetary_amount >= 0)
);

create index if not exists hospitality_stay_contexts_property_status_idx on public.hospitality_stay_contexts (property_id, reservation_status, arrival_at);
create index if not exists hospitality_entitlement_decisions_property_time_idx on public.hospitality_entitlement_decisions (property_id, decided_at desc);
create index if not exists hospitality_entitlement_redemptions_property_time_idx on public.hospitality_entitlement_redemptions (property_id, redeemed_at desc);

alter table public.hospitality_stay_contexts enable row level security;
alter table public.hospitality_entitlement_definitions enable row level security;
alter table public.hospitality_entitlement_rule_sets enable row level security;
alter table public.hospitality_entitlement_rules enable row level security;
alter table public.hospitality_entitlement_decisions enable row level security;
alter table public.hospitality_entitlement_redemptions enable row level security;

-- Property-scoped operational entitlement records use the canonical property-membership boundary.
drop policy if exists hospitality_entitlement_decisions_property_read on public.hospitality_entitlement_decisions;
create policy hospitality_entitlement_decisions_property_read on public.hospitality_entitlement_decisions for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_entitlement_decisions.org_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner','admin','platform_admin'))
  or exists (select 1 from public.hospitality_property_memberships hpm where hpm.org_id = hospitality_entitlement_decisions.org_id and hpm.property_id = hospitality_entitlement_decisions.property_id and hpm.user_id = auth.uid() and hpm.status = 'active')
);

drop policy if exists hospitality_entitlement_redemptions_property_read on public.hospitality_entitlement_redemptions;
create policy hospitality_entitlement_redemptions_property_read on public.hospitality_entitlement_redemptions for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_entitlement_redemptions.org_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner','admin','platform_admin'))
  or exists (select 1 from public.hospitality_property_memberships hpm where hpm.org_id = hospitality_entitlement_redemptions.org_id and hpm.property_id = hospitality_entitlement_redemptions.property_id and hpm.user_id = auth.uid() and hpm.status = 'active')
);

-- Remaining configuration/context tables are readable to active organization members; sensitive mutations remain server-side.
create policy hospitality_stay_contexts_org_read on public.hospitality_stay_contexts for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_stay_contexts.org_id and om.user_id = auth.uid() and om.status = 'active')
);
create policy hospitality_entitlement_definitions_org_read on public.hospitality_entitlement_definitions for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_entitlement_definitions.org_id and om.user_id = auth.uid() and om.status = 'active')
);
create policy hospitality_entitlement_rule_sets_org_read on public.hospitality_entitlement_rule_sets for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_entitlement_rule_sets.org_id and om.user_id = auth.uid() and om.status = 'active')
);
create policy hospitality_entitlement_rules_org_read on public.hospitality_entitlement_rules for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_entitlement_rules.org_id and om.user_id = auth.uid() and om.status = 'active')
);

revoke all on public.hospitality_stay_contexts from authenticated;
revoke all on public.hospitality_entitlement_definitions from authenticated;
revoke all on public.hospitality_entitlement_rule_sets from authenticated;
revoke all on public.hospitality_entitlement_rules from authenticated;
revoke all on public.hospitality_entitlement_decisions from authenticated;
revoke all on public.hospitality_entitlement_redemptions from authenticated;
grant select on public.hospitality_stay_contexts to authenticated;
grant select on public.hospitality_entitlement_definitions to authenticated;
grant select on public.hospitality_entitlement_rule_sets to authenticated;
grant select on public.hospitality_entitlement_rules to authenticated;
grant select on public.hospitality_entitlement_decisions to authenticated;
grant select on public.hospitality_entitlement_redemptions to authenticated;
