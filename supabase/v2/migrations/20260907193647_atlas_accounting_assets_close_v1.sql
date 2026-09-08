begin;

create table public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  asset_code text not null check (btrim(asset_code) <> ''),
  name text not null check (btrim(name) <> ''),
  description text,
  acquisition_date date not null,
  cost numeric(20,4) not null check (cost > 0),
  salvage_value numeric(20,4) not null default 0 check (salvage_value >= 0),
  useful_life_months integer not null check (useful_life_months > 0),
  depreciation_method text not null default 'straight_line' check (depreciation_method='straight_line'),
  asset_account_id uuid not null,
  accumulated_depreciation_account_id uuid not null,
  depreciation_expense_account_id uuid not null,
  status text not null default 'active' check (status in ('active','disposed')),
  disposal_date date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fixed_assets_salvage_ck check (salvage_value <= cost),
  constraint fixed_assets_disposal_ck check ((status='active' and disposal_date is null) or (status='disposed' and disposal_date is not null)),
  constraint fixed_assets_scope_fk foreign key (org_id,tenant_id) references public.organizations(id,tenant_id) on delete cascade,
  constraint fixed_assets_asset_account_fk foreign key (asset_account_id,tenant_id,org_id) references public.chart_of_accounts(id,tenant_id,org_id),
  constraint fixed_assets_accum_account_fk foreign key (accumulated_depreciation_account_id,tenant_id,org_id) references public.chart_of_accounts(id,tenant_id,org_id),
  constraint fixed_assets_expense_account_fk foreign key (depreciation_expense_account_id,tenant_id,org_id) references public.chart_of_accounts(id,tenant_id,org_id),
  constraint fixed_assets_scope_code_uk unique (tenant_id,org_id,asset_code),
  constraint fixed_assets_scope_id_uk unique (id,tenant_id,org_id)
);

create table public.asset_depreciation_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  asset_id uuid not null,
  depreciation_date date not null,
  amount numeric(20,4) not null check (amount > 0),
  journal_entry_id uuid not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint asset_depreciation_events_scope_fk foreign key (org_id,tenant_id) references public.organizations(id,tenant_id) on delete cascade,
  constraint asset_depreciation_events_asset_fk foreign key (asset_id,tenant_id,org_id) references public.fixed_assets(id,tenant_id,org_id),
  constraint asset_depreciation_events_journal_fk foreign key (journal_entry_id,tenant_id,org_id) references public.journal_entries(id,tenant_id,org_id),
  constraint asset_depreciation_events_period_uk unique (tenant_id,org_id,asset_id,depreciation_date)
);

create table public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_by uuid not null references auth.users(id),
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  reopened_by uuid references auth.users(id),
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_periods_dates_ck check (period_end >= period_start),
  constraint accounting_periods_scope_fk foreign key (org_id,tenant_id) references public.organizations(id,tenant_id) on delete cascade,
  constraint accounting_periods_scope_range_uk unique (tenant_id,org_id,period_start,period_end),
  constraint accounting_periods_scope_id_uk unique (id,tenant_id,org_id),
  constraint accounting_periods_close_state_ck check (
    (status='open' and closed_by is null and closed_at is null)
    or (status='closed' and closed_by is not null and closed_at is not null)
  ),
  constraint accounting_periods_reopen_state_ck check (
    (reopened_by is null and reopened_at is null and reopen_reason is null)
    or (reopened_by is not null and reopened_at is not null and nullif(btrim(reopen_reason),'') is not null)
  )
);

create table public.accounting_close_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  period_id uuid not null,
  task_key text not null check (btrim(task_key) <> ''),
  name text not null check (btrim(name) <> ''),
  task_group text not null check (btrim(task_group) <> ''),
  owner_id uuid references auth.users(id),
  status text not null default 'pending' check (status in ('pending','blocked','completed')),
  blocker text,
  due_at timestamptz,
  weight numeric(10,4) not null default 1 check (weight > 0),
  evidence jsonb not null default '{}'::jsonb,
  completed_by uuid references auth.users(id),
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_close_tasks_scope_fk foreign key (org_id,tenant_id) references public.organizations(id,tenant_id) on delete cascade,
  constraint accounting_close_tasks_period_fk foreign key (period_id,tenant_id,org_id) references public.accounting_periods(id,tenant_id,org_id) on delete cascade,
  constraint accounting_close_tasks_key_uk unique (tenant_id,org_id,period_id,task_key),
  constraint accounting_close_tasks_completion_ck check (
    (status='completed' and completed_by is not null and completed_at is not null and evidence <> '{}'::jsonb)
    or (status in ('pending','blocked') and completed_by is null and completed_at is null)
  )
);

create index fixed_assets_org_tenant_idx on public.fixed_assets(org_id,tenant_id);
create index fixed_assets_asset_account_scope_idx on public.fixed_assets(asset_account_id,tenant_id,org_id);
create index fixed_assets_accum_account_scope_idx on public.fixed_assets(accumulated_depreciation_account_id,tenant_id,org_id);
create index fixed_assets_expense_account_scope_idx on public.fixed_assets(depreciation_expense_account_id,tenant_id,org_id);
create index fixed_assets_created_by_idx on public.fixed_assets(created_by);
create index depreciation_events_org_tenant_idx on public.asset_depreciation_events(org_id,tenant_id);
create index depreciation_events_asset_scope_idx on public.asset_depreciation_events(asset_id,tenant_id,org_id);
create index depreciation_events_journal_scope_idx on public.asset_depreciation_events(journal_entry_id,tenant_id,org_id);
create index depreciation_events_created_by_idx on public.asset_depreciation_events(created_by);
create index accounting_periods_org_tenant_idx on public.accounting_periods(org_id,tenant_id);
create index accounting_periods_scope_dates_idx on public.accounting_periods(tenant_id,org_id,period_start,period_end,status);
create index accounting_periods_created_by_idx on public.accounting_periods(created_by);
create index accounting_periods_closed_by_idx on public.accounting_periods(closed_by) where closed_by is not null;
create index accounting_periods_reopened_by_idx on public.accounting_periods(reopened_by) where reopened_by is not null;
create index accounting_close_tasks_org_tenant_idx on public.accounting_close_tasks(org_id,tenant_id);
create index accounting_close_tasks_period_scope_idx on public.accounting_close_tasks(period_id,tenant_id,org_id,status);
create index accounting_close_tasks_owner_idx on public.accounting_close_tasks(owner_id) where owner_id is not null;
create index accounting_close_tasks_completed_by_idx on public.accounting_close_tasks(completed_by) where completed_by is not null;
create index accounting_close_tasks_created_by_idx on public.accounting_close_tasks(created_by);

alter table public.fixed_assets enable row level security;
alter table public.asset_depreciation_events enable row level security;
alter table public.accounting_periods enable row level security;
alter table public.accounting_close_tasks enable row level security;

create policy fixed_assets_select on public.fixed_assets for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));
create policy depreciation_events_select on public.asset_depreciation_events for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));
create policy accounting_periods_select on public.accounting_periods for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));
create policy accounting_close_tasks_select on public.accounting_close_tasks for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));

revoke all on public.fixed_assets,public.asset_depreciation_events,public.accounting_periods,public.accounting_close_tasks from anon,authenticated;
grant select on public.fixed_assets,public.asset_depreciation_events,public.accounting_periods,public.accounting_close_tasks to authenticated;

commit;