begin;

alter table public.journal_lines
  add constraint journal_lines_scope_id_uk unique (id, tenant_id, org_id);

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  ledger_account_id uuid not null,
  display_name text not null check (btrim(display_name) <> ''),
  institution_name text,
  provider text,
  provider_account_ref text,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  mask text,
  connection_state text not null default 'not_configured' check (connection_state in ('not_configured','configured','live','unavailable')),
  reported_balance numeric(20,4),
  balance_as_of timestamptz,
  source_evidence jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_accounts_scope_fk foreign key (org_id,tenant_id) references public.organizations(id,tenant_id) on delete cascade,
  constraint bank_accounts_ledger_fk foreign key (ledger_account_id,tenant_id,org_id) references public.chart_of_accounts(id,tenant_id,org_id),
  constraint bank_accounts_scope_id_uk unique (id,tenant_id,org_id),
  constraint bank_accounts_provider_truth_ck check (
    connection_state='not_configured'
    or (connection_state in ('configured','unavailable') and nullif(btrim(provider),'') is not null)
    or (connection_state='live' and nullif(btrim(provider),'') is not null and nullif(btrim(provider_account_ref),'') is not null and source_evidence <> '{}'::jsonb)
  )
);

create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  bank_account_id uuid not null,
  external_id text,
  posted_date date not null,
  description text not null check (btrim(description) <> ''),
  merchant text,
  amount numeric(20,4) not null check (amount <> 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  source_state text not null check (source_state in ('manual','imported','provider_live')),
  source_payload jsonb not null default '{}'::jsonb,
  source_fingerprint text,
  classification_account_id uuid,
  classification_note text,
  classified_by uuid references auth.users(id),
  classified_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint bank_transactions_scope_fk foreign key (org_id,tenant_id) references public.organizations(id,tenant_id) on delete cascade,
  constraint bank_transactions_account_fk foreign key (bank_account_id,tenant_id,org_id) references public.bank_accounts(id,tenant_id,org_id) on delete cascade,
  constraint bank_transactions_classification_fk foreign key (classification_account_id,tenant_id,org_id) references public.chart_of_accounts(id,tenant_id,org_id),
  constraint bank_transactions_scope_id_uk unique (id,tenant_id,org_id),
  constraint bank_transactions_manual_actor_ck check (source_state <> 'manual' or created_by is not null),
  constraint bank_transactions_classification_state_ck check (
    (classification_account_id is null and classified_by is null and classified_at is null)
    or (classification_account_id is not null and classified_by is not null and classified_at is not null)
  )
);
create unique index bank_transactions_external_uk on public.bank_transactions(tenant_id,org_id,bank_account_id,external_id) where external_id is not null;

create table public.reconciliation_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  bank_account_id uuid not null,
  period_start date not null,
  period_end date not null,
  statement_ending_balance numeric(20,4) not null,
  status text not null default 'in_progress' check (status in ('in_progress','closed')),
  created_by uuid not null references auth.users(id),
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reconciliation_sessions_dates_ck check (period_end >= period_start),
  constraint reconciliation_sessions_scope_fk foreign key (org_id,tenant_id) references public.organizations(id,tenant_id) on delete cascade,
  constraint reconciliation_sessions_bank_fk foreign key (bank_account_id,tenant_id,org_id) references public.bank_accounts(id,tenant_id,org_id),
  constraint reconciliation_sessions_scope_period_uk unique (tenant_id,org_id,bank_account_id,period_start,period_end),
  constraint reconciliation_sessions_scope_id_uk unique (id,tenant_id,org_id),
  constraint reconciliation_sessions_close_state_ck check (
    (status='in_progress' and closed_by is null and closed_at is null)
    or (status='closed' and closed_by is not null and closed_at is not null)
  )
);

create table public.reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  session_id uuid not null,
  bank_transaction_id uuid not null,
  journal_line_id uuid,
  status text not null default 'unmatched' check (status in ('unmatched','matched','exception')),
  variance numeric(20,4) not null default 0,
  note text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reconciliation_items_scope_fk foreign key (org_id,tenant_id) references public.organizations(id,tenant_id) on delete cascade,
  constraint reconciliation_items_session_fk foreign key (session_id,tenant_id,org_id) references public.reconciliation_sessions(id,tenant_id,org_id) on delete cascade,
  constraint reconciliation_items_tx_fk foreign key (bank_transaction_id,tenant_id,org_id) references public.bank_transactions(id,tenant_id,org_id),
  constraint reconciliation_items_line_fk foreign key (journal_line_id,tenant_id,org_id) references public.journal_lines(id,tenant_id,org_id),
  constraint reconciliation_items_session_tx_uk unique (tenant_id,org_id,session_id,bank_transaction_id),
  constraint reconciliation_items_resolution_ck check (
    (status='unmatched' and journal_line_id is null and resolved_by is null and resolved_at is null)
    or (status in ('matched','exception') and journal_line_id is not null and resolved_by is not null and resolved_at is not null)
  )
);

create index bank_accounts_org_tenant_idx on public.bank_accounts(org_id,tenant_id);
create index bank_accounts_ledger_scope_idx on public.bank_accounts(ledger_account_id,tenant_id,org_id);
create index bank_accounts_created_by_idx on public.bank_accounts(created_by);
create index bank_transactions_org_tenant_idx on public.bank_transactions(org_id,tenant_id);
create index bank_transactions_account_scope_date_idx on public.bank_transactions(bank_account_id,tenant_id,org_id,posted_date);
create index bank_transactions_classification_scope_idx on public.bank_transactions(classification_account_id,tenant_id,org_id) where classification_account_id is not null;
create index bank_transactions_classified_by_idx on public.bank_transactions(classified_by) where classified_by is not null;
create index bank_transactions_created_by_idx on public.bank_transactions(created_by) where created_by is not null;
create index reconciliation_sessions_org_tenant_idx on public.reconciliation_sessions(org_id,tenant_id);
create index reconciliation_sessions_bank_scope_idx on public.reconciliation_sessions(bank_account_id,tenant_id,org_id);
create index reconciliation_sessions_created_by_idx on public.reconciliation_sessions(created_by);
create index reconciliation_sessions_closed_by_idx on public.reconciliation_sessions(closed_by) where closed_by is not null;
create index reconciliation_items_org_tenant_idx on public.reconciliation_items(org_id,tenant_id);
create index reconciliation_items_session_scope_idx on public.reconciliation_items(session_id,tenant_id,org_id);
create index reconciliation_items_tx_scope_idx on public.reconciliation_items(bank_transaction_id,tenant_id,org_id);
create index reconciliation_items_line_scope_idx on public.reconciliation_items(journal_line_id,tenant_id,org_id) where journal_line_id is not null;
create index reconciliation_items_resolved_by_idx on public.reconciliation_items(resolved_by) where resolved_by is not null;

alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.reconciliation_sessions enable row level security;
alter table public.reconciliation_items enable row level security;

create policy bank_accounts_select on public.bank_accounts for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));
create policy bank_transactions_select on public.bank_transactions for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));
create policy reconciliation_sessions_select on public.reconciliation_sessions for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));
create policy reconciliation_items_select on public.reconciliation_items for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));

revoke all on public.bank_accounts,public.bank_transactions,public.reconciliation_sessions,public.reconciliation_items from anon,authenticated;
grant select on public.bank_accounts,public.bank_transactions,public.reconciliation_sessions,public.reconciliation_items to authenticated;

commit;