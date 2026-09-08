create or replace function public.set_accounting_bill_approval_state(
  organization_uuid uuid,
  bill_uuid uuid,
  approval_state text
)
returns uuid
language plpgsql
security invoker
set search_path = 'public'
as $function$
declare
  bill_org uuid;
  requested_state text := lower(trim(approval_state));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if organization_uuid is null then
    raise exception 'Organization is required';
  end if;

  if bill_uuid is null then
    raise exception 'Bill is required';
  end if;

  if requested_state not in ('pending', 'approved', 'rejected') then
    raise exception 'Unsupported bill approval state';
  end if;

  select org_id
    into bill_org
    from public.accounting_bills
   where id = bill_uuid
   for update;

  if bill_org is null then
    raise exception 'Bill not found';
  end if;

  if bill_org <> organization_uuid then
    raise exception 'Bill organization mismatch';
  end if;

  if not public.can_write_accounting_data(bill_org) then
    raise exception 'Accounting role required';
  end if;

  update public.accounting_bills
     set approval_state = requested_state
   where id = bill_uuid
     and org_id = organization_uuid;

  return bill_uuid;
end;
$function$;

revoke all on function public.set_accounting_bill_approval_state(uuid, uuid, text) from public;
revoke all on function public.set_accounting_bill_approval_state(uuid, uuid, text) from anon;
grant execute on function public.set_accounting_bill_approval_state(uuid, uuid, text) to authenticated;
