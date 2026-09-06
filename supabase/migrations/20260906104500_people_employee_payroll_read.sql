begin;

drop policy if exists employees_payroll_read on public.employees;

create policy employees_payroll_read on public.employees
for select to authenticated
using (
  public.has_identity_permission(org_id, 'payroll.read')
);

commit;
