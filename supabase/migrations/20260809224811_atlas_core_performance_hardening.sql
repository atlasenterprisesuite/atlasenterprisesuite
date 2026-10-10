begin;

create index if not exists atlas_platform_admins_created_by_idx on public.atlas_platform_admins(created_by);
create index if not exists audit_logs_org_id_idx on public.audit_logs(org_id);
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists customers_org_id_idx on public.customers(org_id);
create index if not exists documents_org_id_idx on public.documents(org_id);
create index if not exists employees_org_id_idx on public.employees(org_id);
create index if not exists employees_user_id_idx on public.employees(user_id);
create index if not exists expenses_category_id_idx on public.expenses(category_id);
create index if not exists expenses_org_id_idx on public.expenses(org_id);
create index if not exists expenses_vendor_id_idx on public.expenses(vendor_id);
create index if not exists invoice_lines_invoice_id_idx on public.invoice_lines(invoice_id);
create index if not exists invoice_lines_org_id_idx on public.invoice_lines(org_id);
create index if not exists invoice_lines_product_id_idx on public.invoice_lines(product_id);
create index if not exists invoices_customer_id_idx on public.invoices(customer_id);
create index if not exists journal_lines_account_id_idx on public.journal_lines(account_id);
create index if not exists journal_lines_journal_entry_id_idx on public.journal_lines(journal_entry_id);
create index if not exists journal_lines_org_id_idx on public.journal_lines(org_id);
create index if not exists organizations_created_by_idx on public.organizations(created_by);
create index if not exists payments_invoice_id_idx on public.payments(invoice_id);
create index if not exists payments_org_id_idx on public.payments(org_id);
create index if not exists vendors_org_id_idx on public.vendors(org_id);

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for all to authenticated
using(id=(select auth.uid())) with check(id=(select auth.uid()));

drop policy if exists employees_read on public.employees;
create policy employees_read on public.employees for select to authenticated
using(public.can_manage_people(org_id) or user_id=(select auth.uid()));

drop policy if exists personal_intelligence_memory_self on public.personal_intelligence_memory;
create policy personal_intelligence_memory_self on public.personal_intelligence_memory for all to authenticated
using(owner_user_id=(select auth.uid())) with check(owner_user_id=(select auth.uid()));

drop policy if exists personal_intelligence_runs_self on public.personal_intelligence_runs;
create policy personal_intelligence_runs_self on public.personal_intelligence_runs for all to authenticated
using(owner_user_id=(select auth.uid())) with check(owner_user_id=(select auth.uid()));

drop policy if exists calendar_events_read on public.calendar_events;
create policy calendar_events_read on public.calendar_events for select to authenticated
using(owner_user_id=(select auth.uid()));
drop policy if exists calendar_events_insert on public.calendar_events;
create policy calendar_events_insert on public.calendar_events for insert to authenticated
with check(owner_user_id=(select auth.uid()) and (org_id is null or public.is_org_member(org_id)));
drop policy if exists calendar_events_update on public.calendar_events;
create policy calendar_events_update on public.calendar_events for update to authenticated
using(owner_user_id=(select auth.uid())) with check(owner_user_id=(select auth.uid()) and (org_id is null or public.is_org_member(org_id)));
drop policy if exists calendar_events_delete on public.calendar_events;
create policy calendar_events_delete on public.calendar_events for delete to authenticated
using(owner_user_id=(select auth.uid()));

commit;
