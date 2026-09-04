create or replace function public.start_accounting_reconciliation(
  organization_uuid uuid,
  bank_account_uuid uuid,
  period_start_date date,
  period_end_date date,
  statement_balance numeric,
  ledger_balance numeric
)
returns uuid
language plpgsql
security invoker
set search_path = 'public'
as $function$
declare
  account_org uuid;
  account_entity uuid;
  session_uuid uuid;
  item_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if organization_uuid is null then raise exception 'Organization is required'; end if;
  if bank_account_uuid is null then raise exception 'Bank account is required'; end if;
  if period_start_date is null or period_end_date is null then raise exception 'Reconciliation period is required'; end if;
  if period_end_date < period_start_date then raise exception 'Reconciliation period end must be on or after period start'; end if;
  if statement_balance is null or ledger_balance is null then raise exception 'Reconciliation balances are required'; end if;

  select org_id, entity_id into account_org, account_entity
    from public.accounting_bank_accounts where id = bank_account_uuid for update;
  if account_org is null then raise exception 'Bank account not found'; end if;
  if account_org <> organization_uuid then raise exception 'Bank account organization mismatch'; end if;
  if not public.can_write_accounting_data(organization_uuid) then raise exception 'Accounting role required'; end if;

  insert into public.accounting_reconciliation_sessions (
    org_id, entity_id, bank_account_id, period_start, period_end,
    statement_ending_balance, ledger_ending_balance, status, readiness_score
  ) values (
    organization_uuid, account_entity, bank_account_uuid, period_start_date, period_end_date,
    statement_balance, ledger_balance, 'in_review', 0
  ) returning id into session_uuid;

  insert into public.accounting_reconciliation_items (
    org_id, session_id, transaction_id, match_type, status, variance
  )
  select organization_uuid, session_uuid, t.id, 'unmatched', 'open', 0
    from public.accounting_transactions t
   where t.org_id = organization_uuid
     and t.bank_account_id = bank_account_uuid
     and t.posted_date between period_start_date and period_end_date;
  get diagnostics item_count = row_count;

  update public.accounting_reconciliation_sessions
     set readiness_score = case when item_count = 0 and statement_balance = ledger_balance then 100 else 0 end
   where id = session_uuid;
  return session_uuid;
exception
  when unique_violation then raise exception 'A reconciliation already exists for this bank account and period';
end;
$function$;

create or replace function public.resolve_accounting_reconciliation_item(
  organization_uuid uuid,
  item_uuid uuid,
  item_status text,
  item_match_type text,
  item_variance numeric,
  item_note text
)
returns uuid
language plpgsql
security invoker
set search_path = 'public'
as $function$
declare
  requested_status text := lower(trim(item_status));
  requested_match_type text := lower(trim(item_match_type));
  item_org uuid;
  item_session uuid;
  session_status text;
  statement_balance numeric;
  ledger_balance numeric;
  total_items integer := 0;
  open_items integer := 0;
  readiness numeric := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if organization_uuid is null then raise exception 'Organization is required'; end if;
  if item_uuid is null then raise exception 'Reconciliation item is required'; end if;
  if requested_status not in ('resolved', 'excluded') then raise exception 'Unsupported reconciliation item status'; end if;
  if requested_match_type not in ('matched', 'unmatched', 'duplicate', 'timing_difference', 'transfer', 'manual') then raise exception 'Unsupported reconciliation match type'; end if;
  if item_variance is null then raise exception 'Reconciliation variance is required'; end if;

  select org_id, session_id into item_org, item_session
    from public.accounting_reconciliation_items where id = item_uuid for update;
  if item_org is null then raise exception 'Reconciliation item not found'; end if;
  if item_org <> organization_uuid then raise exception 'Reconciliation item organization mismatch'; end if;
  if not public.can_write_accounting_data(organization_uuid) then raise exception 'Accounting role required'; end if;

  select status, statement_ending_balance, ledger_ending_balance
    into session_status, statement_balance, ledger_balance
    from public.accounting_reconciliation_sessions
   where id = item_session and org_id = organization_uuid for update;
  if session_status is null then raise exception 'Reconciliation session not found'; end if;
  if session_status in ('reconciled', 'locked') then raise exception 'Closed reconciliation cannot be changed'; end if;

  update public.accounting_reconciliation_items
     set status = requested_status,
         match_type = requested_match_type,
         variance = item_variance,
         note = nullif(trim(item_note), ''),
         resolved_by = auth.uid(),
         resolved_at = now()
   where id = item_uuid and org_id = organization_uuid;

  select count(*), count(*) filter (where status = 'open')
    into total_items, open_items
    from public.accounting_reconciliation_items
   where session_id = item_session and org_id = organization_uuid;

  readiness := case
    when open_items = 0 and statement_balance is not null and ledger_balance is not null and statement_balance = ledger_balance then 100
    when total_items = 0 then 0
    else round(((total_items - open_items)::numeric / total_items::numeric) * 100, 2)
  end;
  if readiness = 100 and (statement_balance is null or ledger_balance is null or statement_balance <> ledger_balance) then readiness := 99; end if;

  update public.accounting_reconciliation_sessions
     set status = 'in_review', readiness_score = least(readiness, 100)
   where id = item_session and org_id = organization_uuid;
  return item_uuid;
end;
$function$;

create or replace function public.close_accounting_reconciliation(
  organization_uuid uuid,
  session_uuid uuid
)
returns uuid
language plpgsql
security invoker
set search_path = 'public'
as $function$
declare
  session_org uuid;
  session_status text;
  statement_balance numeric;
  ledger_balance numeric;
  open_items integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if organization_uuid is null then raise exception 'Organization is required'; end if;
  if session_uuid is null then raise exception 'Reconciliation session is required'; end if;

  select org_id, status, statement_ending_balance, ledger_ending_balance
    into session_org, session_status, statement_balance, ledger_balance
    from public.accounting_reconciliation_sessions where id = session_uuid for update;
  if session_org is null then raise exception 'Reconciliation session not found'; end if;
  if session_org <> organization_uuid then raise exception 'Reconciliation session organization mismatch'; end if;
  if not public.can_write_accounting_data(organization_uuid) then raise exception 'Accounting role required'; end if;
  if session_status in ('reconciled', 'locked') then raise exception 'Reconciliation is already closed'; end if;
  if statement_balance is null or ledger_balance is null then raise exception 'Reconciliation balances are required'; end if;
  if statement_balance <> ledger_balance then raise exception 'Reconciliation difference must be zero before closing'; end if;

  select count(*) into open_items
    from public.accounting_reconciliation_items
   where session_id = session_uuid and org_id = organization_uuid and status = 'open';
  if open_items > 0 then raise exception 'All reconciliation items must be resolved or excluded before closing'; end if;

  update public.accounting_reconciliation_sessions
     set status = 'reconciled', readiness_score = 100, closed_by = auth.uid(), closed_at = now()
   where id = session_uuid and org_id = organization_uuid;
  return session_uuid;
end;
$function$;

revoke all on function public.start_accounting_reconciliation(uuid, uuid, date, date, numeric, numeric) from public;
revoke all on function public.start_accounting_reconciliation(uuid, uuid, date, date, numeric, numeric) from anon;
grant execute on function public.start_accounting_reconciliation(uuid, uuid, date, date, numeric, numeric) to authenticated;
revoke all on function public.resolve_accounting_reconciliation_item(uuid, uuid, text, text, numeric, text) from public;
revoke all on function public.resolve_accounting_reconciliation_item(uuid, uuid, text, text, numeric, text) from anon;
grant execute on function public.resolve_accounting_reconciliation_item(uuid, uuid, text, text, numeric, text) to authenticated;
revoke all on function public.close_accounting_reconciliation(uuid, uuid) from public;
revoke all on function public.close_accounting_reconciliation(uuid, uuid) from anon;
grant execute on function public.close_accounting_reconciliation(uuid, uuid) to authenticated;
