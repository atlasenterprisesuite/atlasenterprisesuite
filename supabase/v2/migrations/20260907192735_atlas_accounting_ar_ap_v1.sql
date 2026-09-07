begin;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  customer_number text not null check (btrim(customer_number) <> ''),
  name text not null check (btrim(name) <> ''),
  email text,
  phone text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_scope_fk foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  constraint customers_scope_number_uk unique (tenant_id, org_id, customer_number),
  constraint customers_scope_id_uk unique (id, tenant_id, org_id)
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  vendor_number text not null check (btrim(vendor_number) <> ''),
  name text not null check (btrim(name) <> ''),
  email text,
  phone text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendors_scope_fk foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  constraint vendors_scope_number_uk unique (tenant_id, org_id, vendor_number),
  constraint vendors_scope_id_uk unique (id, tenant_id, org_id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  customer_id uuid not null,
  invoice_number text not null check (btrim(invoice_number) <> ''),
  issue_date date not null,
  due_date date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft' check (status in ('draft','open','partially_paid','paid','void')),
  memo text,
  posted_journal_id uuid,
  created_by uuid not null references auth.users(id),
  posted_by uuid references auth.users(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_dates_ck check (due_date >= issue_date),
  constraint invoices_scope_fk foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  constraint invoices_customer_fk foreign key (customer_id, tenant_id, org_id) references public.customers(id, tenant_id, org_id),
  constraint invoices_journal_fk foreign key (posted_journal_id, tenant_id, org_id) references public.journal_entries(id, tenant_id, org_id),
  constraint invoices_scope_number_uk unique (tenant_id, org_id, invoice_number),
  constraint invoices_scope_id_uk unique (id, tenant_id, org_id),
  constraint invoices_post_state_ck check (
    (status = 'draft' and posted_journal_id is null and posted_by is null and posted_at is null)
    or (status in ('open','partially_paid','paid') and posted_journal_id is not null and posted_by is not null and posted_at is not null)
    or status = 'void'
  )
);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  invoice_id uuid not null,
  line_number integer not null check (line_number > 0),
  revenue_account_id uuid not null,
  description text not null check (btrim(description) <> ''),
  quantity numeric(20,4) not null default 1 check (quantity > 0),
  unit_price numeric(20,4) not null check (unit_price >= 0),
  tax_amount numeric(20,4) not null default 0 check (tax_amount >= 0),
  line_total numeric(20,4) generated always as ((quantity * unit_price) + tax_amount) stored,
  created_at timestamptz not null default now(),
  constraint invoice_lines_scope_fk foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  constraint invoice_lines_invoice_fk foreign key (invoice_id, tenant_id, org_id) references public.invoices(id, tenant_id, org_id) on delete cascade,
  constraint invoice_lines_account_fk foreign key (revenue_account_id, tenant_id, org_id) references public.chart_of_accounts(id, tenant_id, org_id),
  constraint invoice_lines_number_uk unique (tenant_id, org_id, invoice_id, line_number)
);

create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  customer_id uuid not null,
  invoice_id uuid not null,
  cash_account_id uuid not null,
  amount numeric(20,4) not null check (amount > 0),
  payment_date date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reference text,
  status text not null default 'draft' check (status in ('draft','posted','void')),
  posted_journal_id uuid,
  created_by uuid not null references auth.users(id),
  posted_by uuid references auth.users(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_payments_scope_fk foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  constraint customer_payments_customer_fk foreign key (customer_id, tenant_id, org_id) references public.customers(id, tenant_id, org_id),
  constraint customer_payments_invoice_fk foreign key (invoice_id, tenant_id, org_id) references public.invoices(id, tenant_id, org_id),
  constraint customer_payments_cash_account_fk foreign key (cash_account_id, tenant_id, org_id) references public.chart_of_accounts(id, tenant_id, org_id),
  constraint customer_payments_journal_fk foreign key (posted_journal_id, tenant_id, org_id) references public.journal_entries(id, tenant_id, org_id),
  constraint customer_payments_scope_id_uk unique (id, tenant_id, org_id),
  constraint customer_payments_post_state_ck check (
    (status = 'draft' and posted_journal_id is null and posted_by is null and posted_at is null)
    or (status = 'posted' and posted_journal_id is not null and posted_by is not null and posted_at is not null)
    or status = 'void'
  )
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  vendor_id uuid not null,
  bill_number text not null check (btrim(bill_number) <> ''),
  bill_date date not null,
  due_date date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft' check (status in ('draft','open','partially_paid','paid','void')),
  approval_state text not null default 'pending' check (approval_state in ('pending','approved','rejected')),
  memo text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  posted_journal_id uuid,
  created_by uuid not null references auth.users(id),
  posted_by uuid references auth.users(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bills_dates_ck check (due_date >= bill_date),
  constraint bills_scope_fk foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  constraint bills_vendor_fk foreign key (vendor_id, tenant_id, org_id) references public.vendors(id, tenant_id, org_id),
  constraint bills_journal_fk foreign key (posted_journal_id, tenant_id, org_id) references public.journal_entries(id, tenant_id, org_id),
  constraint bills_scope_number_uk unique (tenant_id, org_id, bill_number),
  constraint bills_scope_id_uk unique (id, tenant_id, org_id),
  constraint bills_approval_state_ck check (
    (approval_state = 'pending' and approved_by is null and approved_at is null)
    or (approval_state = 'approved' and approved_by is not null and approved_at is not null)
    or approval_state = 'rejected'
  ),
  constraint bills_post_state_ck check (
    (status = 'draft' and posted_journal_id is null and posted_by is null and posted_at is null)
    or (status in ('open','partially_paid','paid') and posted_journal_id is not null and posted_by is not null and posted_at is not null)
    or status = 'void'
  )
);

create table public.bill_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  bill_id uuid not null,
  line_number integer not null check (line_number > 0),
  expense_account_id uuid not null,
  description text not null check (btrim(description) <> ''),
  quantity numeric(20,4) not null default 1 check (quantity > 0),
  unit_price numeric(20,4) not null check (unit_price >= 0),
  tax_amount numeric(20,4) not null default 0 check (tax_amount >= 0),
  line_total numeric(20,4) generated always as ((quantity * unit_price) + tax_amount) stored,
  created_at timestamptz not null default now(),
  constraint bill_lines_scope_fk foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  constraint bill_lines_bill_fk foreign key (bill_id, tenant_id, org_id) references public.bills(id, tenant_id, org_id) on delete cascade,
  constraint bill_lines_account_fk foreign key (expense_account_id, tenant_id, org_id) references public.chart_of_accounts(id, tenant_id, org_id),
  constraint bill_lines_number_uk unique (tenant_id, org_id, bill_id, line_number)
);

create table public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  vendor_id uuid not null,
  bill_id uuid not null,
  cash_account_id uuid not null,
  amount numeric(20,4) not null check (amount > 0),
  payment_date date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reference text,
  status text not null default 'draft' check (status in ('draft','posted','void')),
  posted_journal_id uuid,
  created_by uuid not null references auth.users(id),
  posted_by uuid references auth.users(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_payments_scope_fk foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  constraint vendor_payments_vendor_fk foreign key (vendor_id, tenant_id, org_id) references public.vendors(id, tenant_id, org_id),
  constraint vendor_payments_bill_fk foreign key (bill_id, tenant_id, org_id) references public.bills(id, tenant_id, org_id),
  constraint vendor_payments_cash_account_fk foreign key (cash_account_id, tenant_id, org_id) references public.chart_of_accounts(id, tenant_id, org_id),
  constraint vendor_payments_journal_fk foreign key (posted_journal_id, tenant_id, org_id) references public.journal_entries(id, tenant_id, org_id),
  constraint vendor_payments_scope_id_uk unique (id, tenant_id, org_id),
  constraint vendor_payments_post_state_ck check (
    (status = 'draft' and posted_journal_id is null and posted_by is null and posted_at is null)
    or (status = 'posted' and posted_journal_id is not null and posted_by is not null and posted_at is not null)
    or status = 'void'
  )
);

create index customers_org_tenant_idx on public.customers(org_id, tenant_id);
create index customers_created_by_idx on public.customers(created_by);
create index vendors_org_tenant_idx on public.vendors(org_id, tenant_id);
create index vendors_created_by_idx on public.vendors(created_by);
create index invoices_org_tenant_idx on public.invoices(org_id, tenant_id);
create index invoices_customer_scope_idx on public.invoices(customer_id, tenant_id, org_id);
create index invoices_journal_scope_idx on public.invoices(posted_journal_id, tenant_id, org_id) where posted_journal_id is not null;
create index invoices_created_by_idx on public.invoices(created_by);
create index invoices_posted_by_idx on public.invoices(posted_by) where posted_by is not null;
create index invoice_lines_org_tenant_idx on public.invoice_lines(org_id, tenant_id);
create index invoice_lines_invoice_scope_idx on public.invoice_lines(invoice_id, tenant_id, org_id);
create index invoice_lines_account_scope_idx on public.invoice_lines(revenue_account_id, tenant_id, org_id);
create index customer_payments_org_tenant_idx on public.customer_payments(org_id, tenant_id);
create index customer_payments_customer_scope_idx on public.customer_payments(customer_id, tenant_id, org_id);
create index customer_payments_invoice_scope_idx on public.customer_payments(invoice_id, tenant_id, org_id);
create index customer_payments_cash_scope_idx on public.customer_payments(cash_account_id, tenant_id, org_id);
create index customer_payments_journal_scope_idx on public.customer_payments(posted_journal_id, tenant_id, org_id) where posted_journal_id is not null;
create index customer_payments_created_by_idx on public.customer_payments(created_by);
create index customer_payments_posted_by_idx on public.customer_payments(posted_by) where posted_by is not null;
create index bills_org_tenant_idx on public.bills(org_id, tenant_id);
create index bills_vendor_scope_idx on public.bills(vendor_id, tenant_id, org_id);
create index bills_journal_scope_idx on public.bills(posted_journal_id, tenant_id, org_id) where posted_journal_id is not null;
create index bills_created_by_idx on public.bills(created_by);
create index bills_approved_by_idx on public.bills(approved_by) where approved_by is not null;
create index bills_posted_by_idx on public.bills(posted_by) where posted_by is not null;
create index bill_lines_org_tenant_idx on public.bill_lines(org_id, tenant_id);
create index bill_lines_bill_scope_idx on public.bill_lines(bill_id, tenant_id, org_id);
create index bill_lines_account_scope_idx on public.bill_lines(expense_account_id, tenant_id, org_id);
create index vendor_payments_org_tenant_idx on public.vendor_payments(org_id, tenant_id);
create index vendor_payments_vendor_scope_idx on public.vendor_payments(vendor_id, tenant_id, org_id);
create index vendor_payments_bill_scope_idx on public.vendor_payments(bill_id, tenant_id, org_id);
create index vendor_payments_cash_scope_idx on public.vendor_payments(cash_account_id, tenant_id, org_id);
create index vendor_payments_journal_scope_idx on public.vendor_payments(posted_journal_id, tenant_id, org_id) where posted_journal_id is not null;
create index vendor_payments_created_by_idx on public.vendor_payments(created_by);
create index vendor_payments_posted_by_idx on public.vendor_payments(posted_by) where posted_by is not null;

alter table public.customers enable row level security;
alter table public.vendors enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.customer_payments enable row level security;
alter table public.bills enable row level security;
alter table public.bill_lines enable row level security;
alter table public.vendor_payments enable row level security;

create policy customers_select on public.customers for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));
create policy vendors_select on public.vendors for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));
create policy invoices_select on public.invoices for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));
create policy invoice_lines_select on public.invoice_lines for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));
create policy customer_payments_select on public.customer_payments for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));
create policy bills_select on public.bills for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));
create policy bill_lines_select on public.bill_lines for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));
create policy vendor_payments_select on public.vendor_payments for select to authenticated using (public.has_identity_permission(tenant_id,org_id,'accounting.read'));

revoke all on public.customers, public.vendors, public.invoices, public.invoice_lines, public.customer_payments, public.bills, public.bill_lines, public.vendor_payments from anon, authenticated;
grant select on public.customers, public.vendors, public.invoices, public.invoice_lines, public.customer_payments, public.bills, public.bill_lines, public.vendor_payments to authenticated;

commit;