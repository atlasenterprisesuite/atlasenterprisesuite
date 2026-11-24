-- Minimize direct table privileges for P2P subledger projections.
revoke all on table public.inventory_receipts from public, anon, authenticated;
revoke all on table public.inventory_receipt_lines from public, anon, authenticated;
revoke all on table public.accounting_bill_lines from public, anon, authenticated;

grant select on table public.inventory_receipts to authenticated;
grant select on table public.inventory_receipt_lines to authenticated;
grant select on table public.accounting_bill_lines to authenticated;
