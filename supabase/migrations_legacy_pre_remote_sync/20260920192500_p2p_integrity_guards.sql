-- Harden ATLAS Procure-to-Pay subledger integrity.
-- Direct REST mutation cannot bypass governed receiving, matching, or inventory-invoice posting.

revoke insert, update, delete on public.inventory_receipts from authenticated;
revoke insert, update, delete on public.inventory_receipt_lines from authenticated;
revoke insert, update, delete on public.accounting_bill_lines from authenticated;
grant select on public.inventory_receipts to authenticated;
grant select on public.inventory_receipt_lines to authenticated;
grant select on public.accounting_bill_lines to authenticated;

drop policy if exists inventory_receipts_insert on public.inventory_receipts;
drop policy if exists inventory_receipt_lines_insert on public.inventory_receipt_lines;
drop policy if exists accounting_bill_lines_write on public.accounting_bill_lines;

revoke all on function public.atlas_ensure_inventory_accounts(uuid) from public, anon, authenticated;

create or replace function public.guard_received_purchase_order_line()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if coalesce(old.received_quantity, 0) > 0 then
      raise exception 'received_purchase_order_line_is_immutable';
    end if;
    return old;
  end if;

  if coalesce(old.received_quantity, 0) > 0 and (
    new.item_id is distinct from old.item_id
    or new.quantity is distinct from old.quantity
    or new.unit_cost is distinct from old.unit_cost
    or new.description is distinct from old.description
    or new.purchase_order_id is distinct from old.purchase_order_id
    or new.org_id is distinct from old.org_id
  ) then
    raise exception 'received_purchase_order_line_is_immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_received_purchase_order_line on public.purchase_order_lines;
create trigger trg_guard_received_purchase_order_line
before update or delete on public.purchase_order_lines
for each row execute function public.guard_received_purchase_order_line();

create or replace function public.guard_received_purchase_order()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  has_receipt boolean;
begin
  if tg_op = 'DELETE' then
    select exists (
      select 1 from public.inventory_receipts ir
      where ir.org_id = old.org_id and ir.purchase_order_id = old.id and ir.status = 'posted'
    ) into has_receipt;
    if has_receipt then raise exception 'received_purchase_order_is_immutable'; end if;
    return old;
  end if;

  select exists (
    select 1 from public.inventory_receipts ir
    where ir.org_id = old.org_id and ir.purchase_order_id = old.id and ir.status = 'posted'
  ) into has_receipt;

  if has_receipt and (
    new.vendor_id is distinct from old.vendor_id
    or new.po_number is distinct from old.po_number
    or new.order_date is distinct from old.order_date
    or new.currency is distinct from old.currency
    or new.org_id is distinct from old.org_id
  ) then
    raise exception 'received_purchase_order_is_immutable';
  end if;

  if has_receipt and new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    raise exception 'received_purchase_order_cannot_be_cancelled';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_received_purchase_order on public.purchase_orders;
create trigger trg_guard_received_purchase_order
before update or delete on public.purchase_orders
for each row execute function public.guard_received_purchase_order();

create or replace function public.guard_matched_accounting_bill()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.match_state = 'three_way_matched' then
      raise exception 'matched_accounting_bill_requires_reversal';
    end if;
    return old;
  end if;

  if old.match_state = 'three_way_matched' and (
    new.org_id is distinct from old.org_id
    or new.purchasing_vendor_id is distinct from old.purchasing_vendor_id
    or new.purchase_order_id is distinct from old.purchase_order_id
    or new.inventory_receipt_id is distinct from old.inventory_receipt_id
    or new.bill_number is distinct from old.bill_number
    or new.bill_date is distinct from old.bill_date
    or new.amount is distinct from old.amount
    or new.match_state is distinct from old.match_state
  ) then
    raise exception 'matched_accounting_bill_economic_fields_are_immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_matched_accounting_bill on public.accounting_bills;
create trigger trg_guard_matched_accounting_bill
before update or delete on public.accounting_bills
for each row execute function public.guard_matched_accounting_bill();

create or replace function public.guard_invoice_line_draft_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  target_invoice_id uuid;
  target_status text;
begin
  target_invoice_id := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;

  select i.status into target_status
  from public.invoices i
  where i.id = target_invoice_id;

  if target_status is null then
    raise exception 'invoice_not_found';
  end if;

  if target_status <> 'draft' then
    raise exception 'invoice_lines_are_immutable_after_issue';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_invoice_line_draft_only on public.invoice_lines;
create trigger trg_guard_invoice_line_draft_only
before insert or update or delete on public.invoice_lines
for each row execute function public.guard_invoice_line_draft_only();

create or replace function public.guard_inventory_posted_invoice_economics()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.inventory_posted_at is not null then
      raise exception 'inventory_posted_invoice_requires_reversal';
    end if;
    return old;
  end if;

  if old.inventory_posted_at is not null and (
    new.org_id is distinct from old.org_id
    or new.customer_id is distinct from old.customer_id
    or new.invoice_number is distinct from old.invoice_number
    or new.issue_date is distinct from old.issue_date
    or new.total is distinct from old.total
    or new.inventory_posted_at is distinct from old.inventory_posted_at
    or new.cogs_amount is distinct from old.cogs_amount
    or new.gross_profit is distinct from old.gross_profit
    or new.gross_margin_pct is distinct from old.gross_margin_pct
  ) then
    raise exception 'inventory_posted_invoice_economic_fields_are_immutable';
  end if;

  if old.inventory_posted_at is not null
     and new.status = 'cancelled'
     and old.status is distinct from 'cancelled' then
    raise exception 'inventory_posted_invoice_requires_reversal';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_inventory_posted_invoice_economics on public.invoices;
create trigger trg_guard_inventory_posted_invoice_economics
before update or delete on public.invoices
for each row execute function public.guard_inventory_posted_invoice_economics();
