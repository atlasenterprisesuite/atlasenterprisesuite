-- Optimize RLS policies that repeatedly evaluate auth.uid() per row.
-- Semantics are intentionally unchanged: only auth.uid() is wrapped in a
-- scalar subquery so PostgreSQL can initialize it once per statement.

-- ATLAS user preferences -----------------------------------------------------

drop policy if exists users_read_own_preferences on public.atlas_user_preferences;
create policy users_read_own_preferences
on public.atlas_user_preferences
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists users_insert_own_preferences on public.atlas_user_preferences;
create policy users_insert_own_preferences
on public.atlas_user_preferences
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    default_org_id is null
    or exists (
      select 1
      from public.organization_members m
      where m.user_id = (select auth.uid())
        and m.org_id = atlas_user_preferences.default_org_id
        and m.status = 'active'
    )
  )
);

drop policy if exists users_update_own_preferences on public.atlas_user_preferences;
create policy users_update_own_preferences
on public.atlas_user_preferences
for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (
    default_org_id is null
    or exists (
      select 1
      from public.organization_members m
      where m.user_id = (select auth.uid())
        and m.org_id = atlas_user_preferences.default_org_id
        and m.status = 'active'
    )
  )
);

-- Accounting inserts --------------------------------------------------------

drop policy if exists accounting_budget_lines_insert on public.accounting_budget_lines;
create policy accounting_budget_lines_insert
on public.accounting_budget_lines
for insert
to public
with check (
  public.can_write_accounting_data(org_id)
  and created_by = (select auth.uid())
);

drop policy if exists accounting_budgets_insert on public.accounting_budgets;
create policy accounting_budgets_insert
on public.accounting_budgets
for insert
to public
with check (
  public.can_write_accounting_data(org_id)
  and created_by = (select auth.uid())
);

drop policy if exists accounting_fx_rates_insert on public.accounting_fx_rates;
create policy accounting_fx_rates_insert
on public.accounting_fx_rates
for insert
to public
with check (
  public.can_write_accounting_data(org_id)
  and created_by = (select auth.uid())
);
