create table if not exists public.accounting_entities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  legal_name text not null,
  jurisdiction text,
  functional_currency text not null default 'USD',
  reporting_currency text not null default 'USD',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, code)
);

create table if not exists public.accounting_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.accounting_entities(id) on delete set null,
  provider text,
  provider_account_ref text,
  display_name text not null,
  account_type text,
  currency text not null default 'USD',
  mask text,
  connection_state text not null default 'not_connected' check (connection_state in ('not_connected','pending','connected','error','disabled')),
  current_balance numeric(18,2),
  balance_as_of timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, provider, provider_account_ref)
);

create table if not exists public.accounting_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.accounting_entities(id) on delete set null,
  bank_account_id uuid references public.accounting_bank_accounts(id) on delete set null,
  external_id text,
  posted_date date not null,
  description text not null,
  merchant text,
  amount numeric(18,2) not null,
  currency text not null default 'USD',
  suggested_account_id uuid references public.chart_of_accounts(id) on delete set null,
  final_account_id uuid references public.chart_of_accounts(id) on delete set null,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status text not null default 'needs_review' check (status in ('needs_review','approved','excluded','flagged','posted')),
  evidence_state text not null default 'missing' check (evidence_state in ('missing','requested','attached','not_required')),
  review_reason text,
  flag text,
  dimension jsonb not null default '{}'::jsonb,
  fingerprint text,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists accounting_transactions_external_uidx
  on public.accounting_transactions(org_id, bank_account_id, external_id)
  where external_id is not null;
create index if not exists accounting_transactions_org_date_idx on public.accounting_transactions(org_id, posted_date desc);
create index if not exists accounting_transactions_review_idx on public.accounting_transactions(org_id, status, confidence);
create index if not exists accounting_transactions_fingerprint_idx on public.accounting_transactions(org_id, fingerprint) where fingerprint is not null;

create table if not exists public.accounting_transaction_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.accounting_entities(id) on delete cascade,
  name text not null,
  match_spec jsonb not null default '{}'::jsonb,
  account_id uuid references public.chart_of_accounts(id) on delete set null,
  dimension jsonb not null default '{}'::jsonb,
  autonomy text not null default 'suggest' check (autonomy in ('observe','suggest','auto_low_risk','review_required')),
  min_confidence numeric(5,4) check (min_confidence is null or (min_confidence >= 0 and min_confidence <= 1)),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounting_transaction_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  transaction_id uuid not null references public.accounting_transactions(id) on delete cascade,
  decision text not null check (decision in ('approve','recategorize','exclude','flag','request_evidence','post')),
  prior_account_id uuid references public.chart_of_accounts(id) on delete set null,
  final_account_id uuid references public.chart_of_accounts(id) on delete set null,
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists accounting_transaction_reviews_tx_idx on public.accounting_transaction_reviews(transaction_id, created_at desc);

create table if not exists public.accounting_reconciliation_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.accounting_entities(id) on delete set null,
  bank_account_id uuid not null references public.accounting_bank_accounts(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  statement_ending_balance numeric(18,2),
  ledger_ending_balance numeric(18,2),
  status text not null default 'open' check (status in ('open','in_review','reconciled','locked')),
  readiness_score numeric(5,2) not null default 0 check (readiness_score >= 0 and readiness_score <= 100),
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, bank_account_id, period_start, period_end)
);

create table if not exists public.accounting_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.accounting_reconciliation_sessions(id) on delete cascade,
  transaction_id uuid references public.accounting_transactions(id) on delete set null,
  match_type text check (match_type in ('matched','unmatched','duplicate','timing_difference','transfer','manual')),
  status text not null default 'open' check (status in ('open','resolved','excluded')),
  variance numeric(18,2) not null default 0,
  note text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists accounting_recon_items_session_idx on public.accounting_reconciliation_items(session_id, status);

create table if not exists public.accounting_bills (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.accounting_entities(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  bill_number text not null,
  bill_date date,
  due_date date,
  amount numeric(18,2) not null default 0,
  balance_due numeric(18,2) not null default 0,
  approval_state text not null default 'pending' check (approval_state in ('pending','approved','on_hold','rejected')),
  match_state text not null default 'no_po' check (match_state in ('three_way_matched','po_only','no_po','exception')),
  status text not null default 'open' check (status in ('open','part_paid','paid','void')),
  source_document_id uuid references public.documents(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, bill_number)
);
create index if not exists accounting_bills_due_idx on public.accounting_bills(org_id, status, due_date);

create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.accounting_entities(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open','closing','review','closed','locked')),
  close_readiness numeric(5,2) not null default 0 check (close_readiness >= 0 and close_readiness <= 100),
  filing_readiness numeric(5,2) not null default 0 check (filing_readiness >= 0 and filing_readiness <= 100),
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, entity_id, period_start, period_end)
);

create table if not exists public.accounting_close_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null references public.accounting_periods(id) on delete cascade,
  task_key text not null,
  name text not null,
  task_group text not null,
  owner_id uuid references auth.users(id) on delete set null,
  owner_label text,
  status text not null default 'open' check (status in ('open','blocked','in_progress','complete','waived')),
  blocker text,
  due_at timestamptz,
  weight numeric(8,3) not null default 1,
  evidence jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(period_id, task_key)
);
create index if not exists accounting_close_tasks_period_idx on public.accounting_close_tasks(period_id, status);

create table if not exists public.accounting_review_queue (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.accounting_entities(id) on delete set null,
  source_type text not null,
  source_id uuid,
  review_type text not null,
  subject text not null,
  note text,
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_label text,
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  status text not null default 'open' check (status in ('open','awaiting_client','approved','rejected','blocked','resolved')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists accounting_review_queue_idx on public.accounting_review_queue(org_id, status, priority, created_at desc);

create table if not exists public.accounting_tax_readiness_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.accounting_entities(id) on delete cascade,
  tax_level text not null check (tax_level in ('federal','state','local','international')),
  jurisdiction text,
  name text not null,
  due_date date,
  status text not null default 'in_progress' check (status in ('not_started','in_progress','ready','blocked','complete')),
  note text,
  requires_professional boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists accounting_tax_tasks_due_idx on public.accounting_tax_readiness_tasks(org_id, status, due_date);

create table if not exists public.accounting_integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.accounting_entities(id) on delete cascade,
  integration_type text not null,
  provider text,
  state text not null default 'not_connected' check (state in ('not_connected','pending','connected','error','disabled','preview')),
  external_tenant_ref text,
  scopes text[] not null default '{}'::text[],
  last_sync_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists accounting_integrations_org_idx on public.accounting_integrations(org_id, integration_type, state);

create table if not exists public.accounting_forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.accounting_entities(id) on delete cascade,
  as_of_date date not null,
  horizon_weeks integer not null default 13 check (horizon_weeks between 1 and 104),
  scenario text not null default 'expected',
  forecast jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists accounting_forecast_snapshots_idx on public.accounting_forecast_snapshots(org_id, as_of_date desc);

-- updated_at triggers
create trigger accounting_entities_updated_at before update on public.accounting_entities for each row execute function public.set_updated_at();
create trigger accounting_bank_accounts_updated_at before update on public.accounting_bank_accounts for each row execute function public.set_updated_at();
create trigger accounting_transactions_updated_at before update on public.accounting_transactions for each row execute function public.set_updated_at();
create trigger accounting_transaction_rules_updated_at before update on public.accounting_transaction_rules for each row execute function public.set_updated_at();
create trigger accounting_reconciliation_sessions_updated_at before update on public.accounting_reconciliation_sessions for each row execute function public.set_updated_at();
create trigger accounting_bills_updated_at before update on public.accounting_bills for each row execute function public.set_updated_at();
create trigger accounting_periods_updated_at before update on public.accounting_periods for each row execute function public.set_updated_at();
create trigger accounting_close_tasks_updated_at before update on public.accounting_close_tasks for each row execute function public.set_updated_at();
create trigger accounting_review_queue_updated_at before update on public.accounting_review_queue for each row execute function public.set_updated_at();
create trigger accounting_tax_readiness_tasks_updated_at before update on public.accounting_tax_readiness_tasks for each row execute function public.set_updated_at();
create trigger accounting_integrations_updated_at before update on public.accounting_integrations for each row execute function public.set_updated_at();

-- RLS
alter table public.accounting_entities enable row level security;
alter table public.accounting_bank_accounts enable row level security;
alter table public.accounting_transactions enable row level security;
alter table public.accounting_transaction_rules enable row level security;
alter table public.accounting_transaction_reviews enable row level security;
alter table public.accounting_reconciliation_sessions enable row level security;
alter table public.accounting_reconciliation_items enable row level security;
alter table public.accounting_bills enable row level security;
alter table public.accounting_periods enable row level security;
alter table public.accounting_close_tasks enable row level security;
alter table public.accounting_review_queue enable row level security;
alter table public.accounting_tax_readiness_tasks enable row level security;
alter table public.accounting_integrations enable row level security;
alter table public.accounting_forecast_snapshots enable row level security;

-- Read policies
create policy accounting_entities_read on public.accounting_entities for select to authenticated using (public.is_org_member(org_id));
create policy accounting_bank_accounts_read on public.accounting_bank_accounts for select to authenticated using (public.is_org_member(org_id));
create policy accounting_transactions_read on public.accounting_transactions for select to authenticated using (public.is_org_member(org_id));
create policy accounting_transaction_rules_read on public.accounting_transaction_rules for select to authenticated using (public.is_org_member(org_id));
create policy accounting_transaction_reviews_read on public.accounting_transaction_reviews for select to authenticated using (public.is_org_member(org_id));
create policy accounting_reconciliation_sessions_read on public.accounting_reconciliation_sessions for select to authenticated using (public.is_org_member(org_id));
create policy accounting_reconciliation_items_read on public.accounting_reconciliation_items for select to authenticated using (public.is_org_member(org_id));
create policy accounting_bills_read on public.accounting_bills for select to authenticated using (public.is_org_member(org_id));
create policy accounting_periods_read on public.accounting_periods for select to authenticated using (public.is_org_member(org_id));
create policy accounting_close_tasks_read on public.accounting_close_tasks for select to authenticated using (public.is_org_member(org_id));
create policy accounting_review_queue_read on public.accounting_review_queue for select to authenticated using (public.is_org_member(org_id));
create policy accounting_tax_readiness_tasks_read on public.accounting_tax_readiness_tasks for select to authenticated using (public.is_org_member(org_id));
create policy accounting_integrations_read on public.accounting_integrations for select to authenticated using (public.is_org_member(org_id));
create policy accounting_forecast_snapshots_read on public.accounting_forecast_snapshots for select to authenticated using (public.is_org_member(org_id));

-- Write policies
create policy accounting_entities_insert on public.accounting_entities for insert to authenticated with check (public.can_write_accounting_data(org_id));
create policy accounting_entities_update on public.accounting_entities for update to authenticated using (public.can_write_accounting_data(org_id)) with check (public.can_write_accounting_data(org_id));
create policy accounting_entities_delete on public.accounting_entities for delete to authenticated using (public.can_write_accounting_data(org_id));
create policy accounting_bank_accounts_insert on public.accounting_bank_accounts for insert to authenticated with check (public.can_write_accounting_data(org_id));
create policy accounting_bank_accounts_update on public.accounting_bank_accounts for update to authenticated using (public.can_write_accounting_data(org_id)) with check (public.can_write_accounting_data(org_id));
create policy accounting_bank_accounts_delete on public.accounting_bank_accounts for delete to authenticated using (public.can_write_accounting_data(org_id));
create policy accounting_transactions_insert on public.accounting_transactions for insert to authenticated with check (public.can_write_accounting_data(org_id));
create policy accounting_transactions_update on public.accounting_transactions for update to authenticated using (public.can_write_accounting_data(org_id)) with check (public.can_write_accounting_data(org_id));
create policy accounting_transactions_delete on public.accounting_transactions for delete to authenticated using (public.can_write_accounting_data(org_id));
create policy accounting_transaction_rules_insert on public.accounting_transaction_rules for insert to authenticated with check (public.can_write_accounting_data(org_id));
create policy accounting_transaction_rules_update on public.accounting_transaction_rules for update to authenticated using (public.can_write_accounting_data(org_id)) with check (public.can_write_accounting_data(org_id));
create policy accounting_transaction_rules_delete on public.accounting_transaction_rules for delete to authenticated using (public.can_write_accounting_data(org_id));
create policy accounting_transaction_reviews_insert on public.accounting_transaction_reviews for insert to authenticated with check (public.can_write_accounting_data(org_id));
create policy accounting_reconciliation_sessions_insert on public.accounting_reconciliation_sessions for insert to authenticated with check (public.can_write_accounting_data(org_id));
create policy accounting_reconciliation_sessions_update on public.accounting_reconciliation_sessions for update to authenticated using (public.can_write_accounting_data(org_id)) with check (public.can_write_accounting_data(org_id));
create policy accounting_reconciliation_sessions_delete on public.accounting_reconciliation_sessions for delete to authenticated using (public.can_write_accounting_data(org_id));
create policy accounting_reconciliation_items_insert on public.accounting_reconciliation_items for insert to authenticated with check (public.can_write_accounting_data(org_id));
create policy accounting_reconciliation_items_update on public.accounting_reconciliation_items for update to authenticated using (public.can_write_accounting_data(org_id)) with check (public.can_write_accounting_data(org_id));
create policy accounting_reconciliation_items_delete on public.accounting_reconciliation_items for delete to authenticated using (public.can_write_accounting_data(org_id));
create policy accounting_bills_insert on public.accounting_bills for insert to authenticated with check (public.can_write_accounting_data(org_id));
create policy accounting_bills_update on public.accounting_bills for update to authenticated using (public.can_write_accounting_data(org_id)) with check (public.can_write_accounting_data(org_id));
create policy accounting_bills_delete on public.accounting_bills for delete to authenticated using (public.can_write_accounting_data(org_id));
create policy accounting_periods_insert on public.accounting_periods for insert to authenticated with check (public.can_write_accounting_data(org_id));
create policy accounting_periods_update on public.accounting_periods for update to authenticated using (public.can_write_accounting_data(org_id)) with check (public.can_write_accounting_data(org_id));
create policy accounting_periods_delete on public.accounting_periods for delete to authenticated using (public.can_write_accounting_data(org_id));
create policy accounting_close_tasks_insert on public.accounting_close_tasks for insert to authenticated with check (public.can_write_accounting_data(org_id));
create policy accounting_close_tasks_update on public.accounting_close_tasks for update to authenticated using (public.can_write_accounting_data(org_id)) with check (public.can_write_accounting_data(org_id));
create policy accounting_close_tasks_delete on public.accounting_close_tasks for delete to authenticated using (public.can_write_accounting_data(org_id));
create policy accounting_review_queue_insert on public.accounting_review_queue for insert to authenticated with check (public.can_write_accounting_data(org_id));
create policy accounting_review_queue_update on public.accounting_review_queue for update to authenticated using (public.can_write_accounting_data(org_id)) with check (public.can_write_accounting_data(org_id));
create policy accounting_review_queue_delete on public.accounting_review_queue for delete to authenticated using (public.can_write_accounting_data(org_id));
create policy accounting_tax_readiness_tasks_insert on public.accounting_tax_readiness_tasks for insert to authenticated with check (public.can_write_accounting_data(org_id));
create policy accounting_tax_readiness_tasks_update on public.accounting_tax_readiness_tasks for update to authenticated using (public.can_write_accounting_data(org_id)) with check (public.can_write_accounting_data(org_id));
create policy accounting_tax_readiness_tasks_delete on public.accounting_tax_readiness_tasks for delete to authenticated using (public.can_write_accounting_data(org_id));
create policy accounting_integrations_insert on public.accounting_integrations for insert to authenticated with check (public.has_org_role(org_id, array['owner','admin']));
create policy accounting_integrations_update on public.accounting_integrations for update to authenticated using (public.has_org_role(org_id, array['owner','admin'])) with check (public.has_org_role(org_id, array['owner','admin']));
create policy accounting_integrations_delete on public.accounting_integrations for delete to authenticated using (public.has_org_role(org_id, array['owner','admin']));
create policy accounting_forecast_snapshots_insert on public.accounting_forecast_snapshots for insert to authenticated with check (public.can_write_accounting_data(org_id));
create policy accounting_forecast_snapshots_delete on public.accounting_forecast_snapshots for delete to authenticated using (public.can_write_accounting_data(org_id));
