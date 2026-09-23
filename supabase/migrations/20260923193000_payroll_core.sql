-- ATLAS Payroll Core + Commercialization.
-- Durable organization-scoped payroll foundation. External tax filing, remittance and
-- direct-deposit execution remain fail-closed until separately configured and verified.

insert into public.identity_permissions (code, description)
values
  ('payroll.read','Read ATLAS Payroll organization-scoped records.'),
  ('payroll.setup.write','Manage payroll employer setup.'),
  ('payroll.worker.read','Read payroll worker records.'),
  ('payroll.worker.write','Manage payroll worker records.'),
  ('payroll.compensation.read','Read worker compensation.'),
  ('payroll.compensation.write','Manage worker compensation.'),
  ('payroll.time.read','Read time and PTO records.'),
  ('payroll.time.write','Manage time entries.'),
  ('payroll.time.approve','Approve time entries.'),
  ('payroll.run.create','Create and prepare payroll runs.'),
  ('payroll.run.approve','Approve payroll runs.'),
  ('payroll.run.process','Process approved payroll runs.'),
  ('payroll.settings.write','Manage payroll settings.'),
  ('payroll.audit.read','Read payroll audit evidence.'),
  ('platform.billing.internal_comp.manage','Authorize internal ATLAS software-fee exemption.')
on conflict (code) do update set description=excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner','payroll.read'),('owner','payroll.setup.write'),('owner','payroll.worker.read'),('owner','payroll.worker.write'),
  ('owner','payroll.compensation.read'),('owner','payroll.compensation.write'),('owner','payroll.time.read'),('owner','payroll.time.write'),
  ('owner','payroll.time.approve'),('owner','payroll.run.create'),('owner','payroll.run.approve'),('owner','payroll.run.process'),
  ('owner','payroll.settings.write'),('owner','payroll.audit.read'),('owner','platform.billing.internal_comp.manage'),
  ('admin','payroll.read'),('admin','payroll.setup.write'),('admin','payroll.worker.read'),('admin','payroll.worker.write'),
  ('admin','payroll.compensation.read'),('admin','payroll.compensation.write'),('admin','payroll.time.read'),('admin','payroll.time.write'),
  ('admin','payroll.time.approve'),('admin','payroll.run.create'),('admin','payroll.run.approve'),('admin','payroll.run.process'),
  ('admin','payroll.settings.write'),('admin','payroll.audit.read'),
  ('viewer','payroll.read'),('viewer','payroll.worker.read'),('viewer','payroll.time.read')
on conflict do nothing;

create table if not exists public.payroll_legal_entities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legal_name text not null check (length(trim(legal_name)) > 0),
  ein_last4 text check (ein_last4 is null or ein_last4 ~ '^[0-9]{4}$'),
  ein_verification_status text not null default 'not_verified'
    check (ein_verification_status in ('not_verified','format_valid','verified_external')),
  effective_from date not null default current_date,
  effective_to date,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tenant_id=organization_id),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.payroll_addresses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legal_entity_id uuid not null references public.payroll_legal_entities(id) on delete cascade,
  address_type text not null check (address_type in ('legal','work','mailing','tax')),
  line1 text not null, line2 text, city text not null, region text not null, postal_code text not null, country_code text not null default 'US',
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  check (tenant_id=organization_id),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.payroll_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legal_entity_id uuid not null references public.payroll_legal_entities(id) on delete cascade,
  jurisdiction text not null,
  filing_status text not null default 'not_configured'
    check (filing_status in ('not_configured','incomplete','configured','externally_verified')),
  effective_from date not null default current_date,
  effective_to date,
  source_reference text,
  updated_at timestamptz not null default now(),
  check (tenant_id=organization_id),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.payroll_admin_bindings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payroll_role text not null check (payroll_role in ('organization_owner','payroll_admin','payroll_approver','payroll_processor','payroll_manager','payroll_viewer')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique(organization_id,user_id),
  check (tenant_id=organization_id)
);

create table if not exists public.payroll_workers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legal_entity_id uuid references public.payroll_legal_entities(id) on delete restrict,
  worker_type text not null check (worker_type in ('employee','contractor')),
  display_name text not null check (length(trim(display_name)) > 0),
  email text,
  employment_status text not null default 'active' check (employment_status in ('draft','active','leave','terminated')),
  hire_date date,
  termination_date date,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tenant_id=organization_id),
  check (termination_date is null or hire_date is null or termination_date >= hire_date)
);

create table if not exists public.payroll_compensation (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.payroll_workers(id) on delete cascade,
  pay_type text not null check (pay_type in ('salary','hourly','contract')),
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  effective_from date not null,
  effective_to date,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check (tenant_id=organization_id),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.payroll_contractors (
  worker_id uuid primary key references public.payroll_workers(id) on delete cascade,
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tax_form_status text not null default 'not_configured' check (tax_form_status in ('not_configured','w9_received','review_required')),
  payment_terms text,
  updated_at timestamptz not null default now(),
  check (tenant_id=organization_id)
);

create table if not exists public.payroll_pay_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legal_entity_id uuid not null references public.payroll_legal_entities(id) on delete cascade,
  cadence text not null check (cadence in ('weekly','biweekly','semimonthly','monthly')),
  next_pay_date date,
  effective_from date not null,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (tenant_id=organization_id),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.payroll_time_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.payroll_workers(id) on delete cascade,
  work_date date not null,
  category text not null check (category in ('regular','overtime','paid_leave','unpaid_leave')),
  source text not null check (source in ('clock','import','manual')),
  minutes integer not null check (minutes >= 0 and minutes <= 1440),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  exception_code text,
  locked_by_run_id uuid,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tenant_id=organization_id)
);

create table if not exists public.payroll_pto_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  accrual_rule jsonb not null default '{}'::jsonb,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  check (tenant_id=organization_id)
);

create table if not exists public.payroll_pto_balances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.payroll_workers(id) on delete cascade,
  policy_id uuid not null references public.payroll_pto_policies(id) on delete cascade,
  balance_minutes integer not null default 0,
  as_of date not null default current_date,
  unique(worker_id,policy_id,as_of),
  check (tenant_id=organization_id)
);

create table if not exists public.payroll_deductions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.payroll_workers(id) on delete cascade,
  deduction_type text not null,
  pretax boolean not null default false,
  amount_cents bigint not null check (amount_cents >= 0),
  effective_from date not null,
  effective_to date,
  check (tenant_id=organization_id)
);

create table if not exists public.payroll_tax_elections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.payroll_workers(id) on delete cascade,
  jurisdiction text not null,
  election_json jsonb not null default '{}'::jsonb,
  effective_from date not null,
  effective_to date,
  check (tenant_id=organization_id)
);

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pay_schedule_id uuid references public.payroll_pay_schedules(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  pay_date date not null,
  status text not null default 'draft' check (status in ('draft','review','awaiting_approval','approved','processing','processed','posted','blocked','failed','cancelled','reversed')),
  blocked_reason text,
  gross_pay_cents bigint,
  employee_taxes_cents bigint,
  employer_taxes_cents bigint,
  net_pay_cents bigint,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  processed_at timestamptz,
  correlation_id uuid not null default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tenant_id=organization_id),
  check (period_end >= period_start)
);

alter table public.payroll_time_entries
  add constraint payroll_time_entries_locked_run_fk
  foreign key (locked_by_run_id) references public.payroll_runs(id) on delete set null;

create table if not exists public.payroll_run_workers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.payroll_runs(id) on delete cascade,
  worker_id uuid not null references public.payroll_workers(id) on delete restrict,
  unique(run_id,worker_id),
  check (tenant_id=organization_id)
);

create table if not exists public.payroll_calculations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.payroll_runs(id) on delete cascade,
  worker_id uuid not null references public.payroll_workers(id) on delete restrict,
  immutable_input jsonb not null,
  result_json jsonb not null,
  rule_version text not null,
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique(run_id,worker_id),
  check (tenant_id=organization_id)
);

create table if not exists public.payroll_liabilities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.payroll_runs(id) on delete cascade,
  liability_type text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  jurisdiction text,
  external_status text not null default 'not_configured' check (external_status in ('not_configured','pending','verified','failed')),
  external_reference text,
  check (tenant_id=organization_id)
);

create table if not exists public.payroll_disbursement_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_label text not null,
  account_last4 text check (account_last4 is null or account_last4 ~ '^[0-9]{4}$'),
  provider text,
  provider_account_id text,
  verification_status text not null default 'not_configured' check (verification_status in ('not_configured','pending','verified','failed')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (tenant_id=organization_id)
);

create table if not exists public.payroll_journal_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null unique references public.payroll_runs(id) on delete cascade,
  status text not null default 'generated' check (status in ('not_generated','generated','awaiting_posting_approval','posted','posting_failed')),
  contract_json jsonb not null,
  accounting_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tenant_id=organization_id)
);

create table if not exists public.payroll_billing_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  billing_mode text not null default 'customer' check (billing_mode in ('customer','internal_comp')),
  billing_status text not null default 'not_configured' check (billing_status in ('not_configured','trial','active','past_due','grace_period','suspended','cancelled','internal_comp')),
  plan_id text,
  pricing_version text,
  billing_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tenant_id=organization_id)
);

create table if not exists public.payroll_entitlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capability text not null,
  enabled boolean not null default true,
  source text not null default 'server',
  created_at timestamptz not null default now(),
  unique(organization_id,capability),
  check (tenant_id=organization_id)
);

create table if not exists public.payroll_setup_progress (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  current_step text not null default 'company' check (current_step in ('company','admins','tax','bank','pay_schedule','workers','benefits','review','complete')),
  completed_steps text[] not null default '{}',
  updated_by uuid not null default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  check (tenant_id=organization_id)
);

create table if not exists public.payroll_help_content (
  content_id text primary key,
  title text not null,
  module text not null default 'payroll',
  route_tags text[] not null default '{}',
  jurisdiction text,
  body text not null,
  source_url text,
  reviewed_date date,
  last_verified_date date,
  owner text,
  active boolean not null default true
);

create table if not exists public.payroll_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  check (tenant_id=organization_id)
);

insert into public.payroll_help_content(content_id,title,route_tags,jurisdiction,body,source_url,reviewed_date,last_verified_date,owner)
values (
  'payroll.ein.basics',
  'Federal EIN',
  array['/payroll/setup/tax'],
  'US-FED',
  'ATLAS provides general employer-setup information. An EIN is distinct from a personal SSN. Use official IRS registration resources when registration is required. This content is not individualized tax advice.',
  'https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number',
  date '2026-09-12',
  date '2026-09-12',
  'ATLAS Tax & Payroll Governance'
) on conflict(content_id) do update set body=excluded.body, source_url=excluded.source_url, last_verified_date=excluded.last_verified_date;

create index if not exists payroll_workers_org_idx on public.payroll_workers(organization_id,employment_status,display_name);
create index if not exists payroll_time_org_worker_date_idx on public.payroll_time_entries(organization_id,worker_id,work_date desc);
create index if not exists payroll_runs_org_paydate_idx on public.payroll_runs(organization_id,pay_date desc);
create index if not exists payroll_audit_org_created_idx on public.payroll_audit_events(organization_id,created_at desc);

create or replace function public.payroll_can_read(p_org_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.has_identity_permission(p_org_id,'payroll.read')
$$;

create or replace function public.payroll_can_manage(p_org_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select
    public.has_identity_permission(p_org_id,'payroll.setup.write')
    or public.has_identity_permission(p_org_id,'payroll.worker.write')
    or public.has_identity_permission(p_org_id,'payroll.run.create')
    or public.has_identity_permission(p_org_id,'payroll.settings.write')
$$;

grant execute on function public.payroll_can_read(uuid) to authenticated;
grant execute on function public.payroll_can_manage(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'payroll_legal_entities','payroll_addresses','payroll_tax_profiles','payroll_admin_bindings',
    'payroll_workers','payroll_compensation','payroll_contractors','payroll_pay_schedules',
    'payroll_time_entries','payroll_pto_policies','payroll_pto_balances','payroll_deductions',
    'payroll_tax_elections','payroll_runs','payroll_run_workers','payroll_calculations',
    'payroll_liabilities','payroll_disbursement_accounts','payroll_journal_contracts',
    'payroll_billing_accounts','payroll_entitlements','payroll_setup_progress','payroll_audit_events'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I','payroll_scope_read_'||t,t);
    execute format('create policy %I on public.%I for select to authenticated using (public.payroll_can_read(organization_id))','payroll_scope_read_'||t,t);
    execute format('drop policy if exists %I on public.%I','payroll_scope_write_'||t,t);
    execute format('create policy %I on public.%I for all to authenticated using (public.payroll_can_manage(organization_id)) with check (public.payroll_can_manage(organization_id) and tenant_id=organization_id)','payroll_scope_write_'||t,t);
  end loop;
end $$;

alter table public.payroll_help_content enable row level security;
drop policy if exists payroll_help_read on public.payroll_help_content;
create policy payroll_help_read on public.payroll_help_content for select to authenticated using (active=true);

create or replace function public.payroll_set_billing_mode(p_organization_id uuid,p_billing_mode text)
returns public.payroll_billing_accounts
language plpgsql security definer set search_path=public as $$
declare
  v_before jsonb;
  v_after public.payroll_billing_accounts;
begin
  if p_billing_mode not in ('customer','internal_comp') then raise exception 'invalid_billing_mode'; end if;
  if p_billing_mode='internal_comp' and not public.has_identity_permission(p_organization_id,'platform.billing.internal_comp.manage') then
    raise exception 'internal_comp_permission_required';
  end if;
  if not public.has_identity_permission(p_organization_id,'payroll.settings.write')
     and not public.has_identity_permission(p_organization_id,'platform.billing.internal_comp.manage') then
    raise exception 'payroll_settings_permission_required';
  end if;

  select to_jsonb(x) into v_before from public.payroll_billing_accounts x where x.organization_id=p_organization_id;
  insert into public.payroll_billing_accounts(tenant_id,organization_id,billing_mode,billing_status)
  values(p_organization_id,p_organization_id,p_billing_mode,case when p_billing_mode='internal_comp' then 'internal_comp' else 'not_configured' end)
  on conflict(organization_id) do update set
    billing_mode=excluded.billing_mode,
    billing_status=case when excluded.billing_mode='internal_comp' then 'internal_comp' else public.payroll_billing_accounts.billing_status end,
    updated_at=now()
  returning * into v_after;

  insert into public.payroll_audit_events(tenant_id,organization_id,actor_user_id,entity_type,entity_id,action,before_json,after_json)
  values(p_organization_id,p_organization_id,auth.uid(),'payroll_billing_account',v_after.id::text,'billing_mode_change',v_before,to_jsonb(v_after));
  return v_after;
end $$;

revoke all on function public.payroll_set_billing_mode(uuid,text) from public;
grant execute on function public.payroll_set_billing_mode(uuid,text) to authenticated;
