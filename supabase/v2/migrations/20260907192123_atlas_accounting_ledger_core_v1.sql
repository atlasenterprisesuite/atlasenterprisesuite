begin;

insert into public.identity_permissions(code, description) values
  ('accounting.read', 'Read accounting records and derived reports'),
  ('accounting.write', 'Create and edit accounting drafts and master data'),
  ('accounting.post', 'Post and reverse governed journal entries'),
  ('accounting.approve', 'Approve governed accounting workflows'),
  ('accounting.close', 'Close accounting periods'),
  ('accounting.admin', 'Administer accounting configuration and controlled reopen operations')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions(role, permission_code)
select role, permission_code
from (values
  ('owner','accounting.read'),('owner','accounting.write'),('owner','accounting.post'),('owner','accounting.approve'),('owner','accounting.close'),('owner','accounting.admin'),
  ('admin','accounting.read'),('admin','accounting.write'),('admin','accounting.post'),('admin','accounting.approve'),('admin','accounting.close'),('admin','accounting.admin'),
  ('viewer','accounting.read')
) as x(role, permission_code)
on conflict do nothing;

insert into public.module_registry(code, display_name, family, status)
values ('accounting', 'ATLAS Accounting', 'finance', 'available')
on conflict (code) do update
set display_name = excluded.display_name,
    family = excluded.family,
    status = excluded.status,
    updated_at = now();

create table public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  account_number text not null check (btrim(account_number) <> ''),
  name text not null check (btrim(name) <> ''),
  account_type text not null check (account_type in ('asset','liability','equity','revenue','expense')),
  normal_balance text not null check (normal_balance in ('debit','credit')),
  active boolean not null default true,
  system_account boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chart_of_accounts_scope_fk foreign key (org_id, tenant_id)
    references public.organizations(id, tenant_id) on delete cascade,
  constraint chart_of_accounts_scope_number_uk unique (tenant_id, org_id, account_number),
  constraint chart_of_accounts_scope_id_uk unique (id, tenant_id, org_id)
);

create table public.accounting_settings (
  tenant_id uuid not null,
  org_id uuid not null,
  base_currency text not null default 'USD' check (base_currency ~ '^[A-Z]{3}$'),
  fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  fiscal_year_start_day smallint not null default 1 check (fiscal_year_start_day between 1 and 31),
  accounting_basis text not null default 'accrual' check (accounting_basis = 'accrual'),
  default_ar_account_id uuid,
  default_ap_account_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, org_id),
  constraint accounting_settings_scope_fk foreign key (org_id, tenant_id)
    references public.organizations(id, tenant_id) on delete cascade,
  constraint accounting_settings_ar_fk foreign key (default_ar_account_id, tenant_id, org_id)
    references public.chart_of_accounts(id, tenant_id, org_id),
  constraint accounting_settings_ap_fk foreign key (default_ap_account_id, tenant_id, org_id)
    references public.chart_of_accounts(id, tenant_id, org_id)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  entry_number text not null check (btrim(entry_number) <> ''),
  entry_date date not null,
  memo text,
  status text not null default 'draft' check (status in ('draft','posted','reversed','void')),
  source_type text,
  source_id text,
  created_by uuid not null references auth.users(id),
  posted_by uuid references auth.users(id),
  posted_at timestamptz,
  reverses_journal_entry_id uuid,
  reversed_by_journal_entry_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_entries_scope_fk foreign key (org_id, tenant_id)
    references public.organizations(id, tenant_id) on delete cascade,
  constraint journal_entries_scope_number_uk unique (tenant_id, org_id, entry_number),
  constraint journal_entries_scope_id_uk unique (id, tenant_id, org_id),
  constraint journal_entries_post_state_ck check (
    (status = 'draft' and posted_by is null and posted_at is null)
    or (status in ('posted','reversed') and posted_by is not null and posted_at is not null)
    or status = 'void'
  )
);

alter table public.journal_entries
  add constraint journal_entries_reverses_fk
  foreign key (reverses_journal_entry_id, tenant_id, org_id)
  references public.journal_entries(id, tenant_id, org_id),
  add constraint journal_entries_reversed_by_fk
  foreign key (reversed_by_journal_entry_id, tenant_id, org_id)
  references public.journal_entries(id, tenant_id, org_id);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  journal_entry_id uuid not null,
  line_number integer not null check (line_number > 0),
  account_id uuid not null,
  description text,
  debit numeric(20,4) not null default 0,
  credit numeric(20,4) not null default 0,
  dimensions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint journal_lines_scope_fk foreign key (org_id, tenant_id)
    references public.organizations(id, tenant_id) on delete cascade,
  constraint journal_lines_journal_fk foreign key (journal_entry_id, tenant_id, org_id)
    references public.journal_entries(id, tenant_id, org_id) on delete cascade,
  constraint journal_lines_account_fk foreign key (account_id, tenant_id, org_id)
    references public.chart_of_accounts(id, tenant_id, org_id),
  constraint journal_lines_number_uk unique (tenant_id, org_id, journal_entry_id, line_number),
  constraint journal_lines_side_ck check (
    debit >= 0 and credit >= 0
    and ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
  )
);

create index chart_of_accounts_scope_active_idx on public.chart_of_accounts(tenant_id, org_id, active, account_number);
create index accounting_settings_ar_idx on public.accounting_settings(default_ar_account_id, tenant_id, org_id) where default_ar_account_id is not null;
create index accounting_settings_ap_idx on public.accounting_settings(default_ap_account_id, tenant_id, org_id) where default_ap_account_id is not null;
create index journal_entries_scope_date_idx on public.journal_entries(tenant_id, org_id, entry_date, status);
create index journal_entries_created_by_idx on public.journal_entries(created_by);
create index journal_entries_posted_by_idx on public.journal_entries(posted_by) where posted_by is not null;
create index journal_entries_reverses_idx on public.journal_entries(reverses_journal_entry_id, tenant_id, org_id) where reverses_journal_entry_id is not null;
create index journal_entries_reversed_by_idx on public.journal_entries(reversed_by_journal_entry_id, tenant_id, org_id) where reversed_by_journal_entry_id is not null;
create index journal_lines_journal_scope_idx on public.journal_lines(journal_entry_id, tenant_id, org_id);
create index journal_lines_account_scope_idx on public.journal_lines(account_id, tenant_id, org_id);

alter table public.accounting_settings enable row level security;
alter table public.chart_of_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

create policy accounting_settings_select on public.accounting_settings
for select to authenticated
using (public.has_identity_permission(tenant_id, org_id, 'accounting.read'));

create policy chart_of_accounts_select on public.chart_of_accounts
for select to authenticated
using (public.has_identity_permission(tenant_id, org_id, 'accounting.read'));

create policy journal_entries_select on public.journal_entries
for select to authenticated
using (public.has_identity_permission(tenant_id, org_id, 'accounting.read'));

create policy journal_lines_select on public.journal_lines
for select to authenticated
using (public.has_identity_permission(tenant_id, org_id, 'accounting.read'));

revoke all on public.accounting_settings, public.chart_of_accounts, public.journal_entries, public.journal_lines from anon, authenticated;
grant select on public.accounting_settings, public.chart_of_accounts, public.journal_entries, public.journal_lines to authenticated;

commit;