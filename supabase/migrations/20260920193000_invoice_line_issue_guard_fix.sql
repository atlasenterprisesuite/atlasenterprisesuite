-- Close cross-invoice line movement edge case:
-- both the source and destination invoice must remain draft for an UPDATE.

create or replace function public.guard_invoice_line_draft_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  old_status text;
  new_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select i.status into old_status
    from public.invoices i
    where i.id = old.invoice_id;

    if old_status is null then raise exception 'invoice_not_found'; end if;
    if old_status <> 'draft' then raise exception 'invoice_lines_are_immutable_after_issue'; end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select i.status into new_status
    from public.invoices i
    where i.id = new.invoice_id;

    if new_status is null then raise exception 'invoice_not_found'; end if;
    if new_status <> 'draft' then raise exception 'invoice_lines_are_immutable_after_issue'; end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
