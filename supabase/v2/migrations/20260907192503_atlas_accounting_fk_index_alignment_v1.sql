create index if not exists accounting_settings_org_tenant_idx on public.accounting_settings(org_id, tenant_id);
create index if not exists chart_of_accounts_org_tenant_idx on public.chart_of_accounts(org_id, tenant_id);
create index if not exists journal_entries_org_tenant_idx on public.journal_entries(org_id, tenant_id);
create index if not exists journal_lines_org_tenant_idx on public.journal_lines(org_id, tenant_id);