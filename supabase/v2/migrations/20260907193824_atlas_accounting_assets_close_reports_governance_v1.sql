begin;

create or replace function private.create_fixed_asset(
  p_tenant_id uuid,p_org_id uuid,p_asset_code text,p_name text,p_description text,p_acquisition_date date,
  p_cost numeric,p_salvage_value numeric,p_useful_life_months integer,p_asset_account_id uuid,p_accumulated_account_id uuid,p_expense_account_id uuid
) returns uuid
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_id uuid; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.write');
  if p_asset_account_id=p_accumulated_account_id or p_asset_account_id=p_expense_account_id or p_accumulated_account_id=p_expense_account_id then raise exception 'Fixed asset ledger accounts must be distinct'; end if;
  if not exists(select 1 from public.chart_of_accounts where id=p_asset_account_id and tenant_id=p_tenant_id and org_id=p_org_id and active and account_type='asset' and normal_balance='debit') then raise exception 'Asset account must be an active debit-normal asset account'; end if;
  if not exists(select 1 from public.chart_of_accounts where id=p_accumulated_account_id and tenant_id=p_tenant_id and org_id=p_org_id and active and account_type='asset' and normal_balance='credit') then raise exception 'Accumulated depreciation account must be an active credit-normal asset account'; end if;
  if not exists(select 1 from public.chart_of_accounts where id=p_expense_account_id and tenant_id=p_tenant_id and org_id=p_org_id and active and account_type='expense') then raise exception 'Depreciation expense account must be an active expense account'; end if;
  insert into public.fixed_assets(tenant_id,org_id,asset_code,name,description,acquisition_date,cost,salvage_value,useful_life_months,asset_account_id,accumulated_depreciation_account_id,depreciation_expense_account_id,created_by)
  values(p_tenant_id,p_org_id,btrim(p_asset_code),btrim(p_name),nullif(btrim(coalesce(p_description,'')),''),p_acquisition_date,p_cost,p_salvage_value,p_useful_life_months,p_asset_account_id,p_accumulated_account_id,p_expense_account_id,auth.uid()) returning id into v_id;
  select to_jsonb(a) into v_after from public.fixed_assets a where id=v_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.asset.create','fixed_assets',v_id::text,null,v_after);
  return v_id;
end;
$$;

create or replace function private.post_asset_depreciation(
  p_tenant_id uuid,p_org_id uuid,p_asset_id uuid,p_depreciation_date date
) returns uuid
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_asset public.fixed_assets%rowtype; v_month_end date; v_basis numeric(30,4); v_monthly numeric(30,4); v_cumulative numeric(30,4); v_remaining numeric(30,4); v_amount numeric(30,4); v_journal uuid; v_event uuid; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.post');
  select * into v_asset from public.fixed_assets where id=p_asset_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_asset.id is null then raise exception 'Fixed asset not found in scope'; end if;
  if v_asset.status<>'active' then raise exception 'Only active fixed assets can be depreciated'; end if;
  if p_depreciation_date<v_asset.acquisition_date then raise exception 'Depreciation date cannot precede acquisition date'; end if;
  v_month_end:=(date_trunc('month',p_depreciation_date)::date + interval '1 month - 1 day')::date;
  if p_depreciation_date<>v_month_end then raise exception 'Depreciation date must be month end'; end if;
  if exists(select 1 from public.asset_depreciation_events where asset_id=p_asset_id and tenant_id=p_tenant_id and org_id=p_org_id and depreciation_date=p_depreciation_date) then raise exception 'Depreciation already posted for this asset and date'; end if;
  v_basis:=v_asset.cost-v_asset.salvage_value;
  v_monthly:=round(v_basis/v_asset.useful_life_months,4);
  select coalesce(sum(amount),0) into v_cumulative from public.asset_depreciation_events where asset_id=p_asset_id and tenant_id=p_tenant_id and org_id=p_org_id;
  v_remaining:=v_basis-v_cumulative;
  if v_remaining<=0 then raise exception 'Asset is fully depreciated'; end if;
  v_amount:=least(v_monthly,v_remaining);
  v_journal:=private.create_accounting_journal_draft(p_tenant_id,p_org_id,'FA-DEP-'||v_asset.asset_code||'-'||to_char(p_depreciation_date,'YYYYMMDD'),p_depreciation_date,'Depreciation - '||v_asset.name,'asset_depreciation',p_asset_id::text);
  insert into public.journal_lines(tenant_id,org_id,journal_entry_id,line_number,account_id,description,debit,credit) values
    (p_tenant_id,p_org_id,v_journal,1,v_asset.depreciation_expense_account_id,'Depreciation expense',v_amount,0),
    (p_tenant_id,p_org_id,v_journal,2,v_asset.accumulated_depreciation_account_id,'Accumulated depreciation',0,v_amount);
  perform private.post_accounting_journal(p_tenant_id,p_org_id,v_journal);
  insert into public.asset_depreciation_events(tenant_id,org_id,asset_id,depreciation_date,amount,journal_entry_id,created_by)
  values(p_tenant_id,p_org_id,p_asset_id,p_depreciation_date,v_amount,v_journal,auth.uid()) returning id into v_event;
  select to_jsonb(e) into v_after from public.asset_depreciation_events e where id=v_event;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.asset.depreciation_post','asset_depreciation_events',v_event::text,null,v_after);
  return v_journal;
end;
$$;

create or replace function private.create_accounting_period(
  p_tenant_id uuid,p_org_id uuid,p_period_start date,p_period_end date
) returns uuid
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_id uuid; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.close');
  if p_period_end<p_period_start then raise exception 'Period end must be on or after period start'; end if;
  if exists(select 1 from public.accounting_periods where tenant_id=p_tenant_id and org_id=p_org_id and daterange(period_start,period_end,'[]') && daterange(p_period_start,p_period_end,'[]')) then raise exception 'Accounting periods cannot overlap'; end if;
  insert into public.accounting_periods(tenant_id,org_id,period_start,period_end,created_by)
  values(p_tenant_id,p_org_id,p_period_start,p_period_end,auth.uid()) returning id into v_id;
  select to_jsonb(p) into v_after from public.accounting_periods p where id=v_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.period.create','accounting_periods',v_id::text,null,v_after);
  return v_id;
end;
$$;

create or replace function private.create_accounting_close_task(
  p_tenant_id uuid,p_org_id uuid,p_period_id uuid,p_task_key text,p_name text,p_task_group text,p_owner_id uuid,p_due_at timestamptz,p_weight numeric
) returns uuid
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_id uuid; v_status text; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.close');
  select status into v_status from public.accounting_periods where id=p_period_id and tenant_id=p_tenant_id and org_id=p_org_id;
  if v_status is null then raise exception 'Accounting period not found in scope'; end if;
  if v_status<>'open' then raise exception 'Close tasks can only be created for open periods'; end if;
  if p_owner_id is not null and not exists(select 1 from public.organization_members where tenant_id=p_tenant_id and org_id=p_org_id and user_id=p_owner_id and status='active') then raise exception 'Close task owner must be an active organization member'; end if;
  insert into public.accounting_close_tasks(tenant_id,org_id,period_id,task_key,name,task_group,owner_id,due_at,weight,created_by)
  values(p_tenant_id,p_org_id,p_period_id,btrim(p_task_key),btrim(p_name),btrim(p_task_group),p_owner_id,p_due_at,p_weight,auth.uid()) returning id into v_id;
  select to_jsonb(t) into v_after from public.accounting_close_tasks t where id=v_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.close_task.create','accounting_close_tasks',v_id::text,null,v_after);
  return v_id;
end;
$$;

create or replace function private.complete_accounting_close_task(
  p_tenant_id uuid,p_org_id uuid,p_task_id uuid,p_evidence jsonb
) returns void
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_status text; v_period_status text;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.close');
  select to_jsonb(t),t.status,p.status into v_before,v_status,v_period_status
  from public.accounting_close_tasks t join public.accounting_periods p on p.id=t.period_id and p.tenant_id=t.tenant_id and p.org_id=t.org_id
  where t.id=p_task_id and t.tenant_id=p_tenant_id and t.org_id=p_org_id for update of t;
  if v_before is null then raise exception 'Close task not found in scope'; end if;
  if v_period_status<>'open' then raise exception 'Period is not open'; end if;
  if v_status='completed' then raise exception 'Close task already completed'; end if;
  if coalesce(p_evidence,'{}'::jsonb)='{}'::jsonb then raise exception 'Close task completion requires evidence'; end if;
  update public.accounting_close_tasks set status='completed',blocker=null,evidence=p_evidence,completed_by=auth.uid(),completed_at=now(),updated_at=now() where id=p_task_id;
  select to_jsonb(t) into v_after from public.accounting_close_tasks t where id=p_task_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.close_task.complete','accounting_close_tasks',p_task_id::text,v_before,v_after);
end;
$$;

create or replace function private.close_accounting_period(
  p_tenant_id uuid,p_org_id uuid,p_period_id uuid
) returns void
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_period public.accounting_periods%rowtype; v_incomplete integer; v_drafts integer; v_open_recon integer; v_before jsonb; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.close');
  select * into v_period from public.accounting_periods where id=p_period_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_period.id is null then raise exception 'Accounting period not found in scope'; end if;
  if v_period.status<>'open' then raise exception 'Accounting period is already closed'; end if;
  select count(*) into v_incomplete from public.accounting_close_tasks where period_id=p_period_id and tenant_id=p_tenant_id and org_id=p_org_id and status<>'completed';
  if v_incomplete>0 then raise exception 'Accounting period has % incomplete close tasks',v_incomplete; end if;
  select count(*) into v_drafts from public.journal_entries where tenant_id=p_tenant_id and org_id=p_org_id and entry_date between v_period.period_start and v_period.period_end and status='draft';
  if v_drafts>0 then raise exception 'Accounting period has % draft journal entries',v_drafts; end if;
  select count(*) into v_open_recon from public.reconciliation_sessions where tenant_id=p_tenant_id and org_id=p_org_id and status='in_progress' and daterange(period_start,period_end,'[]') && daterange(v_period.period_start,v_period.period_end,'[]');
  if v_open_recon>0 then raise exception 'Accounting period has % open reconciliation sessions',v_open_recon; end if;
  v_before:=to_jsonb(v_period);
  update public.accounting_periods set status='closed',closed_by=auth.uid(),closed_at=now(),updated_at=now() where id=p_period_id;
  select to_jsonb(p) into v_after from public.accounting_periods p where id=p_period_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.period.close','accounting_periods',p_period_id::text,v_before,v_after);
end;
$$;

create or replace function private.reopen_accounting_period(
  p_tenant_id uuid,p_org_id uuid,p_period_id uuid,p_reason text
) returns void
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_period public.accounting_periods%rowtype; v_before jsonb; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.admin');
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Reopen reason is required'; end if;
  select * into v_period from public.accounting_periods where id=p_period_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_period.id is null then raise exception 'Accounting period not found in scope'; end if;
  if v_period.status<>'closed' then raise exception 'Only closed accounting periods can be reopened'; end if;
  v_before:=to_jsonb(v_period);
  update public.accounting_periods set status='open',closed_by=null,closed_at=null,reopened_by=auth.uid(),reopened_at=now(),reopen_reason=btrim(p_reason),updated_at=now() where id=p_period_id;
  select to_jsonb(p) into v_after from public.accounting_periods p where id=p_period_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.period.reopen','accounting_periods',p_period_id::text,v_before,v_after);
end;
$$;

create or replace function public.create_fixed_asset(uuid,uuid,text,text,text,date,numeric,numeric,integer,uuid,uuid,uuid) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.create_fixed_asset($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12); $$;
create or replace function public.post_asset_depreciation(uuid,uuid,uuid,date) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.post_asset_depreciation($1,$2,$3,$4); $$;
create or replace function public.create_accounting_period(uuid,uuid,date,date) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.create_accounting_period($1,$2,$3,$4); $$;
create or replace function public.create_accounting_close_task(uuid,uuid,uuid,text,text,text,uuid,timestamptz,numeric) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.create_accounting_close_task($1,$2,$3,$4,$5,$6,$7,$8,$9); $$;
create or replace function public.complete_accounting_close_task(uuid,uuid,uuid,jsonb) returns void language sql security invoker set search_path=public,private,pg_temp as $$ select private.complete_accounting_close_task($1,$2,$3,$4); $$;
create or replace function public.close_accounting_period(uuid,uuid,uuid) returns void language sql security invoker set search_path=public,private,pg_temp as $$ select private.close_accounting_period($1,$2,$3); $$;
create or replace function public.reopen_accounting_period(uuid,uuid,uuid,text) returns void language sql security invoker set search_path=public,private,pg_temp as $$ select private.reopen_accounting_period($1,$2,$3,$4); $$;

create or replace function public.accounting_trial_balance(p_tenant_id uuid,p_org_id uuid,p_as_of date)
returns table(account_id uuid,account_number text,account_name text,account_type text,total_debit numeric,total_credit numeric,balance numeric)
language plpgsql security invoker set search_path=public,pg_temp
as $$
begin
  if not public.has_identity_permission(p_tenant_id,p_org_id,'accounting.read') then raise exception 'accounting.read permission required'; end if;
  return query
  select a.id,a.account_number,a.name,a.account_type,
         coalesce(sum(case when j.status in ('posted','reversed') and j.entry_date<=p_as_of then l.debit else 0 end),0)::numeric,
         coalesce(sum(case when j.status in ('posted','reversed') and j.entry_date<=p_as_of then l.credit else 0 end),0)::numeric,
         coalesce(sum(case when j.status in ('posted','reversed') and j.entry_date<=p_as_of then l.debit-l.credit else 0 end),0)::numeric
  from public.chart_of_accounts a
  left join public.journal_lines l on l.account_id=a.id and l.tenant_id=a.tenant_id and l.org_id=a.org_id
  left join public.journal_entries j on j.id=l.journal_entry_id and j.tenant_id=l.tenant_id and j.org_id=l.org_id
  where a.tenant_id=p_tenant_id and a.org_id=p_org_id
  group by a.id,a.account_number,a.name,a.account_type
  order by a.account_number;
end;
$$;

create or replace function public.accounting_general_ledger(p_tenant_id uuid,p_org_id uuid,p_start_date date,p_end_date date)
returns table(journal_id uuid,line_id uuid,entry_date date,entry_number text,journal_status text,account_number text,account_name text,line_description text,debit numeric,credit numeric,memo text)
language plpgsql security invoker set search_path=public,pg_temp
as $$
begin
  if not public.has_identity_permission(p_tenant_id,p_org_id,'accounting.read') then raise exception 'accounting.read permission required'; end if;
  if p_end_date<p_start_date then raise exception 'Report end date must be on or after start date'; end if;
  return query
  select j.id,l.id,j.entry_date,j.entry_number,j.status,a.account_number,a.name,l.description,l.debit,l.credit,j.memo
  from public.journal_entries j
  join public.journal_lines l on l.journal_entry_id=j.id and l.tenant_id=j.tenant_id and l.org_id=j.org_id
  join public.chart_of_accounts a on a.id=l.account_id and a.tenant_id=l.tenant_id and a.org_id=l.org_id
  where j.tenant_id=p_tenant_id and j.org_id=p_org_id and j.status in ('posted','reversed') and j.entry_date between p_start_date and p_end_date
  order by j.entry_date,j.entry_number,l.line_number;
end;
$$;

create or replace function public.accounting_profit_and_loss(p_tenant_id uuid,p_org_id uuid,p_start_date date,p_end_date date)
returns table(account_id uuid,account_number text,account_name text,account_type text,amount numeric)
language plpgsql security invoker set search_path=public,pg_temp
as $$
begin
  if not public.has_identity_permission(p_tenant_id,p_org_id,'accounting.read') then raise exception 'accounting.read permission required'; end if;
  if p_end_date<p_start_date then raise exception 'Report end date must be on or after start date'; end if;
  return query
  select a.id,a.account_number,a.name,a.account_type,
         case when a.account_type='revenue' then coalesce(sum(l.credit-l.debit),0) else coalesce(sum(l.debit-l.credit),0) end::numeric
  from public.chart_of_accounts a
  left join public.journal_lines l on l.account_id=a.id and l.tenant_id=a.tenant_id and l.org_id=a.org_id
  left join public.journal_entries j on j.id=l.journal_entry_id and j.tenant_id=l.tenant_id and j.org_id=l.org_id and j.status in ('posted','reversed') and j.entry_date between p_start_date and p_end_date
  where a.tenant_id=p_tenant_id and a.org_id=p_org_id and a.account_type in ('revenue','expense')
  group by a.id,a.account_number,a.name,a.account_type
  order by a.account_type,a.account_number;
end;
$$;

create or replace function public.accounting_balance_sheet(p_tenant_id uuid,p_org_id uuid,p_as_of date)
returns table(account_id uuid,account_number text,account_name text,account_type text,amount numeric,synthetic boolean)
language plpgsql security invoker set search_path=public,pg_temp
as $$
declare v_current_earnings numeric(30,4);
begin
  if not public.has_identity_permission(p_tenant_id,p_org_id,'accounting.read') then raise exception 'accounting.read permission required'; end if;
  select coalesce(sum(case when a.account_type='revenue' then l.credit-l.debit when a.account_type='expense' then -(l.debit-l.credit) else 0 end),0)
    into v_current_earnings
  from public.journal_entries j
  join public.journal_lines l on l.journal_entry_id=j.id and l.tenant_id=j.tenant_id and l.org_id=j.org_id
  join public.chart_of_accounts a on a.id=l.account_id and a.tenant_id=l.tenant_id and a.org_id=l.org_id
  where j.tenant_id=p_tenant_id and j.org_id=p_org_id and j.status in ('posted','reversed') and j.entry_date<=p_as_of and a.account_type in ('revenue','expense');

  return query
  select a.id,a.account_number,a.name,a.account_type,
         case when a.account_type='asset' then coalesce(sum(case when j.status in ('posted','reversed') and j.entry_date<=p_as_of then l.debit-l.credit else 0 end),0)
              else coalesce(sum(case when j.status in ('posted','reversed') and j.entry_date<=p_as_of then l.credit-l.debit else 0 end),0) end::numeric,
         false
  from public.chart_of_accounts a
  left join public.journal_lines l on l.account_id=a.id and l.tenant_id=a.tenant_id and l.org_id=a.org_id
  left join public.journal_entries j on j.id=l.journal_entry_id and j.tenant_id=l.tenant_id and j.org_id=l.org_id
  where a.tenant_id=p_tenant_id and a.org_id=p_org_id and a.account_type in ('asset','liability','equity')
  group by a.id,a.account_number,a.name,a.account_type
  union all
  select null::uuid,'CURRENT-EARNINGS'::text,'Current Earnings'::text,'equity'::text,v_current_earnings::numeric,true
  order by 4,2;
end;
$$;

revoke all on function private.create_fixed_asset(uuid,uuid,text,text,text,date,numeric,numeric,integer,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private.post_asset_depreciation(uuid,uuid,uuid,date) from public,anon,authenticated;
revoke all on function private.create_accounting_period(uuid,uuid,date,date) from public,anon,authenticated;
revoke all on function private.create_accounting_close_task(uuid,uuid,uuid,text,text,text,uuid,timestamptz,numeric) from public,anon,authenticated;
revoke all on function private.complete_accounting_close_task(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function private.close_accounting_period(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private.reopen_accounting_period(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.create_fixed_asset(uuid,uuid,text,text,text,date,numeric,numeric,integer,uuid,uuid,uuid) to authenticated;
grant execute on function private.post_asset_depreciation(uuid,uuid,uuid,date) to authenticated;
grant execute on function private.create_accounting_period(uuid,uuid,date,date) to authenticated;
grant execute on function private.create_accounting_close_task(uuid,uuid,uuid,text,text,text,uuid,timestamptz,numeric) to authenticated;
grant execute on function private.complete_accounting_close_task(uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function private.close_accounting_period(uuid,uuid,uuid) to authenticated;
grant execute on function private.reopen_accounting_period(uuid,uuid,uuid,text) to authenticated;

revoke all on function public.create_fixed_asset(uuid,uuid,text,text,text,date,numeric,numeric,integer,uuid,uuid,uuid) from public,anon;
revoke all on function public.post_asset_depreciation(uuid,uuid,uuid,date) from public,anon;
revoke all on function public.create_accounting_period(uuid,uuid,date,date) from public,anon;
revoke all on function public.create_accounting_close_task(uuid,uuid,uuid,text,text,text,uuid,timestamptz,numeric) from public,anon;
revoke all on function public.complete_accounting_close_task(uuid,uuid,uuid,jsonb) from public,anon;
revoke all on function public.close_accounting_period(uuid,uuid,uuid) from public,anon;
revoke all on function public.reopen_accounting_period(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.create_fixed_asset(uuid,uuid,text,text,text,date,numeric,numeric,integer,uuid,uuid,uuid) to authenticated;
grant execute on function public.post_asset_depreciation(uuid,uuid,uuid,date) to authenticated;
grant execute on function public.create_accounting_period(uuid,uuid,date,date) to authenticated;
grant execute on function public.create_accounting_close_task(uuid,uuid,uuid,text,text,text,uuid,timestamptz,numeric) to authenticated;
grant execute on function public.complete_accounting_close_task(uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function public.close_accounting_period(uuid,uuid,uuid) to authenticated;
grant execute on function public.reopen_accounting_period(uuid,uuid,uuid,text) to authenticated;

revoke all on function public.accounting_trial_balance(uuid,uuid,date) from public,anon;
revoke all on function public.accounting_general_ledger(uuid,uuid,date,date) from public,anon;
revoke all on function public.accounting_profit_and_loss(uuid,uuid,date,date) from public,anon;
revoke all on function public.accounting_balance_sheet(uuid,uuid,date) from public,anon;
grant execute on function public.accounting_trial_balance(uuid,uuid,date) to authenticated;
grant execute on function public.accounting_general_ledger(uuid,uuid,date,date) to authenticated;
grant execute on function public.accounting_profit_and_loss(uuid,uuid,date,date) to authenticated;
grant execute on function public.accounting_balance_sheet(uuid,uuid,date) to authenticated;

commit;