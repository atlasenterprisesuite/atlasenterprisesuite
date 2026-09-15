-- ATLAS Accounting back-to-front completion spine
-- Extends the existing governed Accounting schema; does not create a parallel ledger.

alter table public.accounting_bank_accounts
  add column if not exists ledger_account_id uuid references public.chart_of_accounts(id) on delete set null;

create index if not exists accounting_bank_accounts_ledger_account_idx
  on public.accounting_bank_accounts(ledger_account_id)
  where ledger_account_id is not null;

alter table public.accounting_transactions
  add column if not exists journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  add column if not exists classification_source text not null default 'unclassified',
  add column if not exists reviewed_at timestamptz,
  add column if not exists posted_at timestamptz;

create unique index if not exists accounting_transactions_journal_entry_uidx
  on public.accounting_transactions(journal_entry_id)
  where journal_entry_id is not null;

create unique index if not exists accounting_transactions_fingerprint_uidx
  on public.accounting_transactions(org_id, fingerprint)
  where fingerprint is not null;

create or replace function public.get_accounting_trial_balance(
  organization_uuid uuid,
  entity_uuid uuid,
  start_date date,
  end_date date
)
returns table(
  account_id uuid,
  account_number text,
  account_name text,
  account_type text,
  total_debit numeric,
  total_credit numeric,
  debit_balance numeric,
  credit_balance numeric,
  normal_balance numeric
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(organization_uuid) then raise exception 'Organization membership required'; end if;
  if start_date is null or end_date is null or end_date < start_date then raise exception 'Valid report date range required'; end if;

  return query
  select
    c.id,
    c.account_number,
    c.name,
    c.account_type,
    coalesce(sum(l.debit), 0)::numeric,
    coalesce(sum(l.credit), 0)::numeric,
    greatest(coalesce(sum(l.debit - l.credit), 0), 0)::numeric,
    greatest(coalesce(sum(l.credit - l.debit), 0), 0)::numeric,
    case
      when c.account_type in ('asset','expense') then coalesce(sum(l.debit - l.credit), 0)
      else coalesce(sum(l.credit - l.debit), 0)
    end::numeric
  from public.chart_of_accounts c
  left join public.journal_lines l
    on l.org_id = c.org_id
   and l.account_id = c.id
  left join public.journal_entries j
    on j.id = l.journal_entry_id
   and j.org_id = c.org_id
   and j.status = 'posted'
   and j.entry_date between start_date and end_date
   and (entity_uuid is null or j.entity_id = entity_uuid)
  where c.org_id = organization_uuid
    and c.active
  group by c.id, c.account_number, c.name, c.account_type
  having coalesce(sum(case when j.id is not null then l.debit else 0 end),0) <> 0
      or coalesce(sum(case when j.id is not null then l.credit else 0 end),0) <> 0
  order by c.account_number;
end;
$$;

create or replace function public.get_accounting_income_statement(
  organization_uuid uuid,
  entity_uuid uuid,
  start_date date,
  end_date date
)
returns table(
  line_order integer,
  section text,
  account_number text,
  account_name text,
  amount numeric
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(organization_uuid) then raise exception 'Organization membership required'; end if;
  if start_date is null or end_date is null or end_date < start_date then raise exception 'Valid report date range required'; end if;

  return query
  with balances as (
    select
      c.account_number,
      c.name,
      c.account_type,
      case
        when c.account_type = 'revenue' then coalesce(sum(l.credit - l.debit),0)
        when c.account_type = 'expense' then coalesce(sum(l.debit - l.credit),0)
        else 0
      end::numeric as amount
    from public.chart_of_accounts c
    left join public.journal_lines l on l.org_id=c.org_id and l.account_id=c.id
    left join public.journal_entries j
      on j.id=l.journal_entry_id and j.org_id=c.org_id
     and j.status='posted'
     and j.entry_date between start_date and end_date
     and (entity_uuid is null or j.entity_id=entity_uuid)
    where c.org_id=organization_uuid and c.active and c.account_type in ('revenue','expense')
    group by c.account_number,c.name,c.account_type
  ), totals as (
    select
      coalesce(sum(amount) filter (where account_type='revenue'),0)::numeric as revenue_total,
      coalesce(sum(amount) filter (where account_type='expense'),0)::numeric as expense_total
    from balances
  )
  select 100, 'revenue', b.account_number, b.name, b.amount from balances b where b.account_type='revenue' and b.amount<>0
  union all
  select 200, 'total_revenue', null, 'Total Revenue', t.revenue_total from totals t
  union all
  select 300, 'expense', b.account_number, b.name, b.amount from balances b where b.account_type='expense' and b.amount<>0
  union all
  select 400, 'total_expense', null, 'Total Expenses', t.expense_total from totals t
  union all
  select 500, 'net_income', null, 'Net Income', (t.revenue_total-t.expense_total) from totals t
  order by 1,3 nulls last;
end;
$$;

create or replace function public.get_accounting_balance_sheet(
  organization_uuid uuid,
  entity_uuid uuid,
  as_of_date date
)
returns table(
  line_order integer,
  section text,
  account_number text,
  account_name text,
  amount numeric
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(organization_uuid) then raise exception 'Organization membership required'; end if;
  if as_of_date is null then raise exception 'As-of date required'; end if;

  return query
  with balances as (
    select
      c.account_number,
      c.name,
      c.account_type,
      case
        when c.account_type='asset' then coalesce(sum(l.debit-l.credit),0)
        when c.account_type in ('liability','equity') then coalesce(sum(l.credit-l.debit),0)
        when c.account_type='revenue' then coalesce(sum(l.credit-l.debit),0)
        when c.account_type='expense' then coalesce(sum(l.debit-l.credit),0)
        else 0
      end::numeric as amount
    from public.chart_of_accounts c
    left join public.journal_lines l on l.org_id=c.org_id and l.account_id=c.id
    left join public.journal_entries j
      on j.id=l.journal_entry_id and j.org_id=c.org_id
     and j.status='posted'
     and j.entry_date<=as_of_date
     and (entity_uuid is null or j.entity_id=entity_uuid)
    where c.org_id=organization_uuid and c.active
    group by c.account_number,c.name,c.account_type
  ), totals as (
    select
      coalesce(sum(amount) filter (where account_type='asset'),0)::numeric assets,
      coalesce(sum(amount) filter (where account_type='liability'),0)::numeric liabilities,
      coalesce(sum(amount) filter (where account_type='equity'),0)::numeric equity,
      (coalesce(sum(amount) filter (where account_type='revenue'),0)-coalesce(sum(amount) filter (where account_type='expense'),0))::numeric current_earnings
    from balances
  )
  select 100,'asset',b.account_number,b.name,b.amount from balances b where b.account_type='asset' and b.amount<>0
  union all select 200,'total_assets',null,'Total Assets',t.assets from totals t
  union all select 300,'liability',b.account_number,b.name,b.amount from balances b where b.account_type='liability' and b.amount<>0
  union all select 400,'total_liabilities',null,'Total Liabilities',t.liabilities from totals t
  union all select 500,'equity',b.account_number,b.name,b.amount from balances b where b.account_type='equity' and b.amount<>0
  union all select 550,'current_earnings',null,'Current Earnings',t.current_earnings from totals t
  union all select 600,'total_equity',null,'Total Equity',t.equity+t.current_earnings from totals t
  union all select 700,'total_liabilities_equity',null,'Total Liabilities & Equity',t.liabilities+t.equity+t.current_earnings from totals t
  order by 1,3 nulls last;
end;
$$;

create or replace function public.get_accounting_general_ledger(
  organization_uuid uuid,
  entity_uuid uuid,
  start_date date,
  end_date date
)
returns table(
  entry_date date,
  entry_number text,
  journal_entry_id uuid,
  account_number text,
  account_name text,
  account_type text,
  memo text,
  debit numeric,
  credit numeric,
  running_balance numeric
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(organization_uuid) then raise exception 'Organization membership required'; end if;
  if start_date is null or end_date is null or end_date < start_date then raise exception 'Valid report date range required'; end if;

  return query
  select
    j.entry_date,
    j.entry_number,
    j.id,
    c.account_number,
    c.name,
    c.account_type,
    j.memo,
    l.debit,
    l.credit,
    sum(case when c.account_type in ('asset','expense') then l.debit-l.credit else l.credit-l.debit end)
      over(partition by c.id order by j.entry_date,j.entry_number,l.id rows unbounded preceding)::numeric
  from public.journal_entries j
  join public.journal_lines l on l.journal_entry_id=j.id and l.org_id=j.org_id
  join public.chart_of_accounts c on c.id=l.account_id and c.org_id=j.org_id
  where j.org_id=organization_uuid
    and j.status='posted'
    and j.entry_date between start_date and end_date
    and (entity_uuid is null or j.entity_id=entity_uuid)
  order by c.account_number,j.entry_date,j.entry_number,l.id;
end;
$$;

create or replace function public.get_accounting_cash_flow(
  organization_uuid uuid,
  entity_uuid uuid,
  start_date date,
  end_date date
)
returns table(
  line_order integer,
  activity_type text,
  amount numeric
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(organization_uuid) then raise exception 'Organization membership required'; end if;
  if start_date is null or end_date is null or end_date < start_date then raise exception 'Valid report date range required'; end if;

  return query
  with cash_accounts as (
    select distinct b.ledger_account_id account_id
    from public.accounting_bank_accounts b
    join public.chart_of_accounts c on c.id=b.ledger_account_id and c.org_id=b.org_id
    where b.org_id=organization_uuid
      and b.ledger_account_id is not null
      and c.account_type='asset'
      and (entity_uuid is null or b.entity_id=entity_uuid)
  ), cash_entries as (
    select j.id journal_id, sum(l.debit-l.credit)::numeric cash_delta
    from public.journal_entries j
    join public.journal_lines l on l.journal_entry_id=j.id and l.org_id=j.org_id
    where j.org_id=organization_uuid
      and j.status='posted'
      and j.entry_date between start_date and end_date
      and (entity_uuid is null or j.entity_id=entity_uuid)
      and l.account_id in (select account_id from cash_accounts)
    group by j.id
    having sum(l.debit-l.credit)<>0
  ), classified as (
    select
      ce.journal_id,
      ce.cash_delta,
      case
        when exists (
          select 1 from public.journal_lines x join public.chart_of_accounts c on c.id=x.account_id
          where x.journal_entry_id=ce.journal_id and x.account_id not in (select account_id from cash_accounts)
            and c.account_type in ('revenue','expense')
        ) then 'operating'
        when exists (
          select 1 from public.journal_lines x join public.chart_of_accounts c on c.id=x.account_id
          where x.journal_entry_id=ce.journal_id and x.account_id not in (select account_id from cash_accounts)
            and c.account_type='asset'
        ) then 'investing'
        when exists (
          select 1 from public.journal_lines x join public.chart_of_accounts c on c.id=x.account_id
          where x.journal_entry_id=ce.journal_id and x.account_id not in (select account_id from cash_accounts)
            and c.account_type in ('liability','equity')
        ) then 'financing'
        else 'operating'
      end activity_type
    from cash_entries ce
  ), totals as (
    select
      coalesce(sum(cash_delta) filter(where activity_type='operating'),0)::numeric operating,
      coalesce(sum(cash_delta) filter(where activity_type='investing'),0)::numeric investing,
      coalesce(sum(cash_delta) filter(where activity_type='financing'),0)::numeric financing
    from classified
  )
  select 100,'operating',operating from totals
  union all select 200,'investing',investing from totals
  union all select 300,'financing',financing from totals
  union all select 400,'net_change_in_cash',operating+investing+financing from totals
  order by 1;
end;
$$;

create or replace function public.calculate_accounting_bank_ledger_balance(
  organization_uuid uuid,
  bank_account_uuid uuid,
  as_of_date date
)
returns numeric
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  ledger_uuid uuid;
  ledger_type text;
  result numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(organization_uuid) then raise exception 'Organization membership required'; end if;
  if as_of_date is null then raise exception 'As-of date required'; end if;

  select b.ledger_account_id,c.account_type into ledger_uuid,ledger_type
  from public.accounting_bank_accounts b
  left join public.chart_of_accounts c on c.id=b.ledger_account_id and c.org_id=b.org_id
  where b.id=bank_account_uuid and b.org_id=organization_uuid;

  if ledger_uuid is null then raise exception 'Bank account is not mapped to a ledger account'; end if;

  select coalesce(sum(case when ledger_type in ('asset','expense') then l.debit-l.credit else l.credit-l.debit end),0)
    into result
  from public.journal_entries j
  join public.journal_lines l on l.journal_entry_id=j.id and l.org_id=j.org_id
  where j.org_id=organization_uuid and j.status='posted' and j.entry_date<=as_of_date and l.account_id=ledger_uuid;

  return result;
end;
$$;

create or replace function public.get_accounting_close_readiness(
  organization_uuid uuid,
  period_uuid uuid
)
returns table(
  ready boolean,
  readiness_score numeric,
  total_tasks integer,
  incomplete_tasks integer,
  unreconciled_sessions integer,
  unresolved_transactions integer,
  draft_journals integer,
  debit_credit_difference numeric
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  p_start date;
  p_end date;
  p_entity uuid;
  t_total integer:=0;
  t_incomplete integer:=0;
  r_open integer:=0;
  tx_open integer:=0;
  j_open integer:=0;
  debits numeric:=0;
  credits numeric:=0;
  score numeric:=0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(organization_uuid) then raise exception 'Organization membership required'; end if;

  select period_start,period_end,entity_id into p_start,p_end,p_entity
  from public.accounting_periods where id=period_uuid and org_id=organization_uuid;
  if p_start is null then raise exception 'Accounting period not found'; end if;

  select count(*),count(*) filter(where lower(status) not in ('completed','complete','done','approved'))
    into t_total,t_incomplete from public.accounting_close_tasks where org_id=organization_uuid and period_id=period_uuid;

  select count(*) into r_open from public.accounting_reconciliation_sessions
  where org_id=organization_uuid and (p_entity is null or entity_id=p_entity)
    and period_end between p_start and p_end and status not in ('reconciled','locked');

  select count(*) into tx_open from public.accounting_transactions
  where org_id=organization_uuid and (p_entity is null or entity_id=p_entity)
    and posted_date between p_start and p_end and status in ('needs_review','flagged','approved');

  select count(*) into j_open from public.journal_entries
  where org_id=organization_uuid and (p_entity is null or entity_id=p_entity)
    and entry_date between p_start and p_end and status<>'posted';

  select coalesce(sum(l.debit),0),coalesce(sum(l.credit),0) into debits,credits
  from public.journal_entries j join public.journal_lines l on l.journal_entry_id=j.id and l.org_id=j.org_id
  where j.org_id=organization_uuid and (p_entity is null or j.entity_id=p_entity)
    and j.status='posted' and j.entry_date between p_start and p_end;

  score := 100;
  if t_total=0 then score:=least(score,75); end if;
  if t_incomplete>0 then score:=least(score,75); end if;
  if r_open>0 then score:=least(score,75); end if;
  if tx_open>0 then score:=least(score,75); end if;
  if j_open>0 then score:=least(score,75); end if;
  if round(debits,2)<>round(credits,2) then score:=least(score,50); end if;

  return query select
    (t_total>0 and t_incomplete=0 and r_open=0 and tx_open=0 and j_open=0 and round(debits,2)=round(credits,2)),
    score,t_total,t_incomplete,r_open,tx_open,j_open,round(debits-credits,2);
end;
$$;

create or replace function public.post_accounting_transaction(
  organization_uuid uuid,
  transaction_uuid uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  tx public.accounting_transactions%rowtype;
  bank_ledger uuid;
  counter_ledger uuid;
  abs_amount numeric;
  journal_uuid uuid;
  entry_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.post') then raise exception 'Accounting post permission required'; end if;

  select * into tx from public.accounting_transactions
  where id=transaction_uuid and org_id=organization_uuid for update;
  if tx.id is null then raise exception 'Accounting transaction not found'; end if;
  if tx.status='posted' and tx.journal_entry_id is not null then return tx.journal_entry_id; end if;
  if tx.status<>'approved' then raise exception 'Transaction must be approved before posting'; end if;
  if tx.bank_account_id is null then raise exception 'Transaction requires a mapped bank account'; end if;
  if tx.final_account_id is null then raise exception 'Transaction requires a final counter account'; end if;
  if tx.amount is null or tx.amount=0 then raise exception 'Transaction amount must be non-zero'; end if;

  select ledger_account_id into bank_ledger from public.accounting_bank_accounts
  where id=tx.bank_account_id and org_id=organization_uuid and (tx.entity_id is null or entity_id=tx.entity_id);
  if bank_ledger is null then raise exception 'Bank account requires a ledger account mapping'; end if;
  counter_ledger:=tx.final_account_id;
  if bank_ledger=counter_ledger then raise exception 'Bank and counter ledger accounts must differ'; end if;

  if exists(select 1 from public.accounting_periods p where p.org_id=organization_uuid and (tx.entity_id is null or p.entity_id=tx.entity_id) and tx.posted_date between p.period_start and p.period_end and p.status in ('closed','locked')) then
    raise exception 'Accounting period is locked';
  end if;

  if (select count(*) from public.chart_of_accounts c where c.org_id=organization_uuid and c.active and c.id in (bank_ledger,counter_ledger))<>2 then
    raise exception 'Both ledger accounts must be active and belong to the organization';
  end if;

  abs_amount:=abs(tx.amount);
  entry_code:='ATX-'||to_char(tx.posted_date,'YYYYMMDD')||'-'||substr(replace(tx.id::text,'-',''),1,12);

  insert into public.journal_entries(
    org_id,entity_id,entry_number,entry_date,memo,status,created_by,
    transaction_currency,functional_currency,exchange_rate
  ) values (
    organization_uuid,tx.entity_id,entry_code,tx.posted_date,
    coalesce(tx.merchant,tx.description,'Imported accounting transaction'),'draft',auth.uid(),
    coalesce(tx.currency,'USD'),coalesce(tx.currency,'USD'),1
  ) returning id into journal_uuid;

  if tx.amount>0 then
    insert into public.journal_lines(org_id,journal_entry_id,account_id,debit,credit) values
      (organization_uuid,journal_uuid,bank_ledger,abs_amount,0),
      (organization_uuid,journal_uuid,counter_ledger,0,abs_amount);
  else
    insert into public.journal_lines(org_id,journal_entry_id,account_id,debit,credit) values
      (organization_uuid,journal_uuid,counter_ledger,abs_amount,0),
      (organization_uuid,journal_uuid,bank_ledger,0,abs_amount);
  end if;

  if not public.validate_journal_entry(journal_uuid) then raise exception 'Journal entry is not balanced'; end if;
  update public.journal_entries set status='posted' where id=journal_uuid;
  update public.accounting_transactions
    set status='posted',journal_entry_id=journal_uuid,posted_at=now(),reviewed_at=coalesce(reviewed_at,now())
    where id=tx.id and org_id=organization_uuid;

  return journal_uuid;
exception
  when unique_violation then
    select journal_entry_id into journal_uuid from public.accounting_transactions where id=transaction_uuid and org_id=organization_uuid;
    if journal_uuid is not null then return journal_uuid; end if;
    raise;
end;
$$;

create or replace function public.close_accounting_period(organization_uuid uuid, period_uuid uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  target_org uuid;
  target_entity uuid;
  target_start date;
  target_end date;
  target_status text;
  total_tasks integer:=0;
  incomplete_tasks integer:=0;
  unreconciled_sessions integer:=0;
  unresolved_transactions integer:=0;
  draft_journals integer:=0;
  posted_debits numeric:=0;
  posted_credits numeric:=0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if organization_uuid is null or period_uuid is null then raise exception 'Organization and period are required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.close') then raise exception 'Accounting close permission required'; end if;

  select org_id,entity_id,period_start,period_end,status
    into target_org,target_entity,target_start,target_end,target_status
  from public.accounting_periods where id=period_uuid for update;

  if target_org is null then raise exception 'Accounting period not found'; end if;
  if target_org<>organization_uuid then raise exception 'Accounting period organization mismatch'; end if;
  if target_status in ('closed','locked') then raise exception 'Accounting period is already closed'; end if;

  select count(*),count(*) filter(where lower(status) not in ('completed','complete','done','approved'))
    into total_tasks,incomplete_tasks from public.accounting_close_tasks where org_id=organization_uuid and period_id=period_uuid;
  if total_tasks=0 then raise exception 'Accounting close checklist is required before period lock'; end if;
  if incomplete_tasks>0 then raise exception 'Accounting close checklist contains incomplete tasks'; end if;

  select count(*) into unreconciled_sessions from public.accounting_reconciliation_sessions
  where org_id=organization_uuid and (target_entity is null or entity_id=target_entity)
    and period_end between target_start and target_end and status not in ('reconciled','locked');
  if unreconciled_sessions>0 then raise exception 'All reconciliation sessions in the period must be closed'; end if;

  select count(*) into unresolved_transactions from public.accounting_transactions
  where org_id=organization_uuid and (target_entity is null or entity_id=target_entity)
    and posted_date between target_start and target_end and status in ('needs_review','flagged','approved');
  if unresolved_transactions>0 then raise exception 'Accounting transactions remain unresolved or unposted'; end if;

  select count(*) into draft_journals from public.journal_entries
  where org_id=organization_uuid and (target_entity is null or entity_id=target_entity)
    and entry_date between target_start and target_end and status<>'posted';
  if draft_journals>0 then raise exception 'Unposted journal entries remain in the period'; end if;

  select coalesce(sum(l.debit),0),coalesce(sum(l.credit),0) into posted_debits,posted_credits
  from public.journal_entries j join public.journal_lines l on l.journal_entry_id=j.id and l.org_id=j.org_id
  where j.org_id=organization_uuid and (target_entity is null or j.entity_id=target_entity)
    and j.status='posted' and j.entry_date between target_start and target_end;
  if round(posted_debits,2)<>round(posted_credits,2) then raise exception 'Posted journal debits and credits must balance before period lock'; end if;

  update public.accounting_periods set status='locked',close_readiness=100,closed_by=auth.uid(),closed_at=now(),updated_at=now()
  where id=period_uuid and org_id=organization_uuid;
  return period_uuid;
end;
$$;

revoke all on function public.get_accounting_trial_balance(uuid,uuid,date,date) from public;
revoke all on function public.get_accounting_income_statement(uuid,uuid,date,date) from public;
revoke all on function public.get_accounting_balance_sheet(uuid,uuid,date) from public;
revoke all on function public.get_accounting_general_ledger(uuid,uuid,date,date) from public;
revoke all on function public.get_accounting_cash_flow(uuid,uuid,date,date) from public;
revoke all on function public.calculate_accounting_bank_ledger_balance(uuid,uuid,date) from public;
revoke all on function public.get_accounting_close_readiness(uuid,uuid) from public;
revoke all on function public.post_accounting_transaction(uuid,uuid) from public;
revoke all on function public.close_accounting_period(uuid,uuid) from public;

grant execute on function public.get_accounting_trial_balance(uuid,uuid,date,date) to authenticated;
grant execute on function public.get_accounting_income_statement(uuid,uuid,date,date) to authenticated;
grant execute on function public.get_accounting_balance_sheet(uuid,uuid,date) to authenticated;
grant execute on function public.get_accounting_general_ledger(uuid,uuid,date,date) to authenticated;
grant execute on function public.get_accounting_cash_flow(uuid,uuid,date,date) to authenticated;
grant execute on function public.calculate_accounting_bank_ledger_balance(uuid,uuid,date) to authenticated;
grant execute on function public.get_accounting_close_readiness(uuid,uuid) to authenticated;
grant execute on function public.post_accounting_transaction(uuid,uuid) to authenticated;
grant execute on function public.close_accounting_period(uuid,uuid) to authenticated;
