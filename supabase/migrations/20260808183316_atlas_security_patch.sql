-- ATLAS Core v0.2.5 security and trigger-safety patch.
begin;

-- Avoid referencing NEW during DELETE triggers and OLD during INSERT triggers.
create or replace function public.refresh_invoice_from_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_uuid uuid;
begin
  if tg_op = 'DELETE' then invoice_uuid := old.invoice_id; else invoice_uuid := new.invoice_id; end if;
  update public.invoices set total = total, updated_at = now() where id = invoice_uuid;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.refresh_invoice_from_lines()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_uuid uuid;
  line_total numeric;
  line_count integer;
begin
  if tg_op = 'DELETE' then invoice_uuid := old.invoice_id; else invoice_uuid := new.invoice_id; end if;
  select count(*), coalesce(sum(quantity * unit_price * (1 + tax_rate / 100)), 0)
    into line_count, line_total
    from public.invoice_lines
   where invoice_id = invoice_uuid;
  if line_count > 0 then
    update public.invoices set total = round(line_total, 2), updated_at = now() where id = invoice_uuid;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Staff may record ordinary expenses and create a missing expense category.
drop policy if exists expense_categories_read on public.expense_categories;
drop policy if exists expense_categories_insert on public.expense_categories;
drop policy if exists expense_categories_update on public.expense_categories;
drop policy if exists expense_categories_delete on public.expense_categories;
create policy expense_categories_read on public.expense_categories for select to authenticated using(public.is_org_member(org_id));
create policy expense_categories_insert on public.expense_categories for insert to authenticated with check(public.can_write_business_data(org_id));
create policy expense_categories_update on public.expense_categories for update to authenticated using(public.can_write_business_data(org_id)) with check(public.can_write_business_data(org_id));
create policy expense_categories_delete on public.expense_categories for delete to authenticated using(public.can_write_business_data(org_id));

commit;
