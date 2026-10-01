-- ATLAS Pay / Global Accounts read-side foundation.
-- External financial-provider actions remain fail-closed until independently verified.

create table if not exists public.pay_capabilities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (length(trim(provider)) between 1 and 120),
  country text not null check (country ~ '^[A-Z]{2}$'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  product_type text not null check (length(trim(product_type)) between 1 and 80),
  operation text not null check (length(trim(operation)) between 1 and 80),
  readiness_state text not null default 'unconfigured' check (
    readiness_state in (
      'unconfigured',
      'configuration_required',
      'provider_sandbox',
      'provider_verified',
      'eligible',
      'restricted',
      'suspended',
      'unavailable'
    )
  ),
  eligibility_state text not null default 'unconfigured' check (
    eligibility_state in (
      'unconfigured',
      'configuration_required',
      'provider_sandbox',
      'provider_verified',
      'eligible',
      'restricted',
      'suspended',
      'unavailable'
    )
  ),
  compliance_tier text,
  limits_json jsonb not null default '{}'::jsonb,
  unavailable_reason text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, country, currency, product_type, operation)
);

create table if not exists public.pay_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (length(trim(provider)) between 1 and 120),
  provider_account_ref text not null check (length(trim(provider_account_ref)) between 1 and 240),
  account_type text not null check (length(trim(account_type)) between 1 and 80),
  country text not null check (country ~ '^[A-Z]{2}$'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'unavailable' check (
    status in (
      'unconfigured',
      'configuration_required',
      'provider_sandbox',
      'provider_verified',
      'eligible',
      'restricted',
      'suspended',
      'unavailable'
    )
  ),
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  masked_identifier text,
  available_balance_minor bigint,
  ledger_balance_minor bigint,
  balance_as_of timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, provider_account_ref)
);

create table if not exists public.pay_activity (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid references public.pay_accounts(id) on delete set null,
  provider text not null check (length(trim(provider)) between 1 and 120),
  provider_event_ref text,
  activity_type text not null check (length(trim(activity_type)) between 1 and 80),
  status text not null check (length(trim(status)) between 1 and 80),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  amount_minor bigint,
  fee_minor bigint,
  description text,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pay_compliance_states (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject_type text not null check (length(trim(subject_type)) between 1 and 80),
  subject_ref text not null check (length(trim(subject_ref)) between 1 and 240),
  provider text not null check (length(trim(provider)) between 1 and 120),
  status text not null default 'unconfigured' check (
    status in (
      'unconfigured',
      'configuration_required',
      'provider_sandbox',
      'provider_verified',
      'eligible',
      'restricted',
      'suspended',
      'unavailable'
    )
  ),
  requirement_code text,
  safe_reason text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, subject_type, subject_ref, provider)
);

create index if not exists pay_capabilities_org_idx
  on public.pay_capabilities (org_id, currency, country, provider);
create index if not exists pay_accounts_org_idx
  on public.pay_accounts (org_id, currency, updated_at desc);
create index if not exists pay_activity_org_time_idx
  on public.pay_activity (org_id, occurred_at desc);
create index if not exists pay_activity_account_time_idx
  on public.pay_activity (org_id, account_id, occurred_at desc);
create index if not exists pay_compliance_org_idx
  on public.pay_compliance_states (org_id, updated_at desc);

alter table public.pay_capabilities enable row level security;
alter table public.pay_accounts enable row level security;
alter table public.pay_activity enable row level security;
alter table public.pay_compliance_states enable row level security;

create policy pay_capabilities_member_read
  on public.pay_capabilities
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.org_id = pay_capabilities.org_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy pay_accounts_member_read
  on public.pay_accounts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.org_id = pay_accounts.org_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy pay_activity_member_read
  on public.pay_activity
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.org_id = pay_activity.org_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy pay_compliance_states_member_read
  on public.pay_compliance_states
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.org_id = pay_compliance_states.org_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

revoke all on public.pay_capabilities from anon;
revoke all on public.pay_accounts from anon;
revoke all on public.pay_activity from anon;
revoke all on public.pay_compliance_states from anon;

revoke all on public.pay_capabilities from authenticated;
revoke all on public.pay_accounts from authenticated;
revoke all on public.pay_activity from authenticated;
revoke all on public.pay_compliance_states from authenticated;

grant select on public.pay_capabilities to authenticated;
grant select on public.pay_accounts to authenticated;
grant select on public.pay_activity to authenticated;
grant select on public.pay_compliance_states to authenticated;

comment on table public.pay_capabilities is
  'Organization-scoped ATLAS Pay capability evidence. Live provider status must be independently verified.';
comment on table public.pay_accounts is
  'Organization-scoped provider account read model. Contains only masked identifiers and integer minor-unit balances.';
comment on table public.pay_activity is
  'Organization-scoped normalized ATLAS Pay read-side activity. Not an accounting ledger.';
comment on table public.pay_compliance_states is
  'Organization-scoped safe compliance/readiness state. Provider secrets and raw identity documents are not stored here.';
