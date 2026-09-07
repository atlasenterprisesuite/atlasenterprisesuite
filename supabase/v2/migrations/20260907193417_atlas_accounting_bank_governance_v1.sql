begin;

create or replace function private.enforce_bank_transaction_source_immutability()
returns trigger
language plpgsql
set search_path=public,private,pg_temp
as $$
begin
  if tg_op='DELETE' then
    raise exception 'Bank source evidence cannot be deleted';
  end if;
  if new.tenant_id<>old.tenant_id or new.org_id<>old.org_id or new.bank_account_id<>old.bank_account_id
     or new.external_id is distinct from old.external_id or new.posted_date<>old.posted_date
     or new.description<>old.description or new.merchant is distinct from old.merchant
     or new.amount<>old.amount or new.currency<>old.currency or new.source_state<>old.source_state
     or new.source_payload<>old.source_payload or new.source_fingerprint is distinct from old.source_fingerprint
     or new.created_by is distinct from old.created_by or new.created_at<>old.created_at then
    raise exception 'Bank source evidence is immutable; only classification fields may change';
  end if;
  return new;
end;
$$;

create trigger bank_transactions_source_immutable_guard
before update or delete on public.bank_transactions
for each row execute function private.enforce_bank_transaction_source_immutability();

create or replace function private.create_bank_account(
  p_tenant_id uuid,p_org_id uuid,p_ledger_account_id uuid,p_display_name text,p_institution_name text,p_currency text
) returns uuid
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_id uuid; v_after jsonb; v_currency text;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.write');
  v_currency:=private.require_base_currency(p_tenant_id,p_org_id,p_currency);
  if not exists(select 1 from public.chart_of_accounts where id=p_ledger_account_id and tenant_id=p_tenant_id and org_id=p_org_id and active and account_type='asset') then
    raise exception 'Bank ledger account must be an active asset account in scope';
  end if;
  insert into public.bank_accounts(tenant_id,org_id,ledger_account_id,display_name,institution_name,currency,created_by)
  values(p_tenant_id,p_org_id,p_ledger_account_id,btrim(p_display_name),nullif(btrim(coalesce(p_institution_name,'')),''),v_currency,auth.uid())
  returning id into v_id;
  select to_jsonb(b) into v_after from public.bank_accounts b where id=v_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.bank_account.create','bank_accounts',v_id::text,null,v_after);
  return v_id;
end;
$$;

create or replace function private.record_manual_bank_transaction(
  p_tenant_id uuid,p_org_id uuid,p_bank_account_id uuid,p_posted_date date,p_description text,p_amount numeric,p_currency text,p_merchant text
) returns uuid
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_id uuid; v_bank public.bank_accounts%rowtype; v_after jsonb; v_currency text:=upper(btrim(p_currency));
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.write');
  select * into v_bank from public.bank_accounts where id=p_bank_account_id and tenant_id=p_tenant_id and org_id=p_org_id;
  if v_bank.id is null then raise exception 'Bank account not found in scope'; end if;
  if v_currency<>v_bank.currency then raise exception 'Transaction currency must match bank account currency'; end if;
  insert into public.bank_transactions(tenant_id,org_id,bank_account_id,posted_date,description,merchant,amount,currency,source_state,source_payload,created_by)
  values(p_tenant_id,p_org_id,p_bank_account_id,p_posted_date,btrim(p_description),nullif(btrim(coalesce(p_merchant,'')),''),p_amount,v_currency,'manual',jsonb_build_object('entry','manual'),auth.uid())
  returning id into v_id;
  select to_jsonb(t) into v_after from public.bank_transactions t where id=v_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.bank_transaction.manual_record','bank_transactions',v_id::text,null,v_after);
  return v_id;
end;
$$;

create or replace function private.classify_bank_transaction(
  p_tenant_id uuid,p_org_id uuid,p_transaction_id uuid,p_account_id uuid,p_note text
) returns void
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_bank_ledger uuid;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.write');
  select to_jsonb(t),b.ledger_account_id into v_before,v_bank_ledger
  from public.bank_transactions t join public.bank_accounts b on b.id=t.bank_account_id and b.tenant_id=t.tenant_id and b.org_id=t.org_id
  where t.id=p_transaction_id and t.tenant_id=p_tenant_id and t.org_id=p_org_id for update of t;
  if v_before is null then raise exception 'Bank transaction not found in scope'; end if;
  if p_account_id=v_bank_ledger then raise exception 'Classification account cannot be the same bank ledger account'; end if;
  if not exists(select 1 from public.chart_of_accounts where id=p_account_id and tenant_id=p_tenant_id and org_id=p_org_id and active) then raise exception 'Classification account is not active in scope'; end if;
  update public.bank_transactions set classification_account_id=p_account_id,classification_note=nullif(btrim(coalesce(p_note,'')),''),classified_by=auth.uid(),classified_at=now() where id=p_transaction_id;
  select to_jsonb(t) into v_after from public.bank_transactions t where id=p_transaction_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.bank_transaction.classify','bank_transactions',p_transaction_id::text,v_before,v_after);
end;
$$;

create or replace function private.start_reconciliation_session(
  p_tenant_id uuid,p_org_id uuid,p_bank_account_id uuid,p_period_start date,p_period_end date,p_statement_ending_balance numeric
) returns uuid
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_id uuid; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.write');
  if p_period_end<p_period_start then raise exception 'Reconciliation period end must be on or after start'; end if;
  if not exists(select 1 from public.bank_accounts where id=p_bank_account_id and tenant_id=p_tenant_id and org_id=p_org_id) then raise exception 'Bank account not found in scope'; end if;
  insert into public.reconciliation_sessions(tenant_id,org_id,bank_account_id,period_start,period_end,statement_ending_balance,created_by)
  values(p_tenant_id,p_org_id,p_bank_account_id,p_period_start,p_period_end,p_statement_ending_balance,auth.uid()) returning id into v_id;
  insert into public.reconciliation_items(tenant_id,org_id,session_id,bank_transaction_id)
  select p_tenant_id,p_org_id,v_id,t.id
  from public.bank_transactions t
  where t.tenant_id=p_tenant_id and t.org_id=p_org_id and t.bank_account_id=p_bank_account_id
    and t.posted_date between p_period_start and p_period_end
    and not exists(
      select 1 from public.reconciliation_items ri
      join public.reconciliation_sessions rs on rs.id=ri.session_id and rs.tenant_id=ri.tenant_id and rs.org_id=ri.org_id
      where ri.bank_transaction_id=t.id and rs.status='closed'
    );
  select to_jsonb(s) into v_after from public.reconciliation_sessions s where id=v_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.reconciliation.start','reconciliation_sessions',v_id::text,null,v_after);
  return v_id;
end;
$$;

create or replace function private.match_reconciliation_item(
  p_tenant_id uuid,p_org_id uuid,p_item_id uuid,p_journal_line_id uuid
) returns void
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_item public.reconciliation_items%rowtype; v_session public.reconciliation_sessions%rowtype; v_tx public.bank_transactions%rowtype;
  v_ledger_account uuid; v_debit numeric(20,4); v_credit numeric(20,4); v_entry_status text; v_variance numeric(20,4); v_before jsonb; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.write');
  select * into v_item from public.reconciliation_items where id=p_item_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_item.id is null then raise exception 'Reconciliation item not found in scope'; end if;
  select * into v_session from public.reconciliation_sessions where id=v_item.session_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_session.status<>'in_progress' then raise exception 'Reconciliation session is closed'; end if;
  select * into v_tx from public.bank_transactions where id=v_item.bank_transaction_id;
  select ledger_account_id into v_ledger_account from public.bank_accounts where id=v_session.bank_account_id;
  select l.debit,l.credit,j.status into v_debit,v_credit,v_entry_status
  from public.journal_lines l join public.journal_entries j on j.id=l.journal_entry_id and j.tenant_id=l.tenant_id and j.org_id=l.org_id
  where l.id=p_journal_line_id and l.tenant_id=p_tenant_id and l.org_id=p_org_id and l.account_id=v_ledger_account;
  if v_entry_status is null then raise exception 'Journal line is not on the bank ledger account'; end if;
  if v_entry_status not in ('posted','reversed') then raise exception 'Only posted ledger lines can be reconciled'; end if;
  v_variance:=v_tx.amount-(v_debit-v_credit);
  v_before:=to_jsonb(v_item);
  update public.reconciliation_items set journal_line_id=p_journal_line_id,status=case when v_variance=0 then 'matched' else 'exception' end,
    variance=v_variance,note=case when v_variance=0 then null else 'Bank amount differs from ledger amount' end,resolved_by=auth.uid(),resolved_at=now(),updated_at=now()
  where id=p_item_id;
  select to_jsonb(i) into v_after from public.reconciliation_items i where id=p_item_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.reconciliation.match','reconciliation_items',p_item_id::text,v_before,v_after);
end;
$$;

create or replace function private.close_reconciliation_session(
  p_tenant_id uuid,p_org_id uuid,p_session_id uuid
) returns void
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_session public.reconciliation_sessions%rowtype; v_ledger_account uuid; v_ledger_balance numeric(30,4); v_missing integer; v_unmatched integer; v_before jsonb; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.approve');
  select * into v_session from public.reconciliation_sessions where id=p_session_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_session.id is null then raise exception 'Reconciliation session not found in scope'; end if;
  if v_session.status<>'in_progress' then raise exception 'Reconciliation session is already closed'; end if;
  select ledger_account_id into v_ledger_account from public.bank_accounts where id=v_session.bank_account_id;
  select count(*) into v_missing
  from public.bank_transactions t
  where t.tenant_id=p_tenant_id and t.org_id=p_org_id and t.bank_account_id=v_session.bank_account_id
    and t.posted_date between v_session.period_start and v_session.period_end
    and not exists(select 1 from public.reconciliation_items i where i.session_id=p_session_id and i.bank_transaction_id=t.id);
  if v_missing>0 then raise exception 'Reconciliation has % bank transactions not included in the session',v_missing; end if;
  select count(*) into v_unmatched from public.reconciliation_items where session_id=p_session_id and status<>'matched';
  if v_unmatched>0 then raise exception 'Reconciliation has % unmatched or exception items',v_unmatched; end if;
  select coalesce(sum(l.debit-l.credit),0) into v_ledger_balance
  from public.journal_lines l join public.journal_entries j on j.id=l.journal_entry_id and j.tenant_id=l.tenant_id and j.org_id=l.org_id
  where l.tenant_id=p_tenant_id and l.org_id=p_org_id and l.account_id=v_ledger_account and j.status in ('posted','reversed') and j.entry_date<=v_session.period_end;
  if v_ledger_balance<>v_session.statement_ending_balance then raise exception 'Statement ending balance % does not equal ledger ending balance %',v_session.statement_ending_balance,v_ledger_balance; end if;
  v_before:=to_jsonb(v_session);
  update public.reconciliation_sessions set status='closed',closed_by=auth.uid(),closed_at=now(),updated_at=now() where id=p_session_id;
  select to_jsonb(s) into v_after from public.reconciliation_sessions s where id=p_session_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.reconciliation.close','reconciliation_sessions',p_session_id::text,v_before,v_after);
end;
$$;

create or replace function public.create_bank_account(uuid,uuid,uuid,text,text,text) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.create_bank_account($1,$2,$3,$4,$5,$6); $$;
create or replace function public.record_manual_bank_transaction(uuid,uuid,uuid,date,text,numeric,text,text) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.record_manual_bank_transaction($1,$2,$3,$4,$5,$6,$7,$8); $$;
create or replace function public.classify_bank_transaction(uuid,uuid,uuid,uuid,text) returns void language sql security invoker set search_path=public,private,pg_temp as $$ select private.classify_bank_transaction($1,$2,$3,$4,$5); $$;
create or replace function public.start_reconciliation_session(uuid,uuid,uuid,date,date,numeric) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.start_reconciliation_session($1,$2,$3,$4,$5,$6); $$;
create or replace function public.match_reconciliation_item(uuid,uuid,uuid,uuid) returns void language sql security invoker set search_path=public,private,pg_temp as $$ select private.match_reconciliation_item($1,$2,$3,$4); $$;
create or replace function public.close_reconciliation_session(uuid,uuid,uuid) returns void language sql security invoker set search_path=public,private,pg_temp as $$ select private.close_reconciliation_session($1,$2,$3); $$;

create or replace function public.set_bank_provider_state_service(
  p_tenant_id uuid,p_org_id uuid,p_bank_account_id uuid,p_state text,p_provider text,p_provider_account_ref text,p_reported_balance numeric,p_balance_as_of timestamptz,p_evidence jsonb
) returns void
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare v_before jsonb; v_after jsonb;
begin
  if p_state not in ('not_configured','configured','live','unavailable') then raise exception 'Invalid provider state'; end if;
  select to_jsonb(b) into v_before from public.bank_accounts b where id=p_bank_account_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_before is null then raise exception 'Bank account not found in scope'; end if;
  update public.bank_accounts set connection_state=p_state,provider=nullif(btrim(coalesce(p_provider,'')),''),provider_account_ref=nullif(btrim(coalesce(p_provider_account_ref,'')),''),
    reported_balance=p_reported_balance,balance_as_of=p_balance_as_of,source_evidence=coalesce(p_evidence,'{}'::jsonb),updated_at=now()
  where id=p_bank_account_id;
  select to_jsonb(b) into v_after from public.bank_accounts b where id=p_bank_account_id;
  insert into public.audit_logs(tenant_id,org_id,actor_id,action,entity_type,entity_id,before_state,after_state,correlation_id)
  values(p_tenant_id,p_org_id,null,'accounting.bank_account.provider_state_service','bank_accounts',p_bank_account_id::text,v_before,v_after,gen_random_uuid()::text);
end;
$$;

create or replace function public.ingest_bank_transaction_service(
  p_tenant_id uuid,p_org_id uuid,p_bank_account_id uuid,p_external_id text,p_posted_date date,p_description text,p_merchant text,p_amount numeric,p_currency text,p_source_state text,p_source_payload jsonb,p_source_fingerprint text
) returns uuid
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare v_id uuid; v_bank public.bank_accounts%rowtype; v_after jsonb;
begin
  if p_source_state not in ('imported','provider_live') then raise exception 'Service ingestion source_state must be imported or provider_live'; end if;
  if nullif(btrim(coalesce(p_external_id,'')),'') is null then raise exception 'External id is required for service ingestion'; end if;
  select * into v_bank from public.bank_accounts where id=p_bank_account_id and tenant_id=p_tenant_id and org_id=p_org_id;
  if v_bank.id is null then raise exception 'Bank account not found in scope'; end if;
  if upper(btrim(p_currency))<>v_bank.currency then raise exception 'Transaction currency must match bank account currency'; end if;
  if p_source_state='provider_live' and v_bank.connection_state<>'live' then raise exception 'Provider-live ingestion requires bank account live state'; end if;
  if p_source_state='provider_live' and coalesce(p_source_payload,'{}'::jsonb)='{}'::jsonb then raise exception 'Provider-live ingestion requires source payload evidence'; end if;
  insert into public.bank_transactions(tenant_id,org_id,bank_account_id,external_id,posted_date,description,merchant,amount,currency,source_state,source_payload,source_fingerprint,created_by)
  values(p_tenant_id,p_org_id,p_bank_account_id,btrim(p_external_id),p_posted_date,btrim(p_description),nullif(btrim(coalesce(p_merchant,'')),''),p_amount,upper(btrim(p_currency)),p_source_state,coalesce(p_source_payload,'{}'::jsonb),nullif(btrim(coalesce(p_source_fingerprint,'')),''),null)
  returning id into v_id;
  select to_jsonb(t) into v_after from public.bank_transactions t where id=v_id;
  insert into public.audit_logs(tenant_id,org_id,actor_id,action,entity_type,entity_id,before_state,after_state,correlation_id)
  values(p_tenant_id,p_org_id,null,'accounting.bank_transaction.ingest_service','bank_transactions',v_id::text,null,v_after,gen_random_uuid()::text);
  return v_id;
end;
$$;

revoke all on function private.create_bank_account(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function private.record_manual_bank_transaction(uuid,uuid,uuid,date,text,numeric,text,text) from public,anon,authenticated;
revoke all on function private.classify_bank_transaction(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function private.start_reconciliation_session(uuid,uuid,uuid,date,date,numeric) from public,anon,authenticated;
revoke all on function private.match_reconciliation_item(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private.close_reconciliation_session(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.create_bank_account(uuid,uuid,uuid,text,text,text) to authenticated;
grant execute on function private.record_manual_bank_transaction(uuid,uuid,uuid,date,text,numeric,text,text) to authenticated;
grant execute on function private.classify_bank_transaction(uuid,uuid,uuid,uuid,text) to authenticated;
grant execute on function private.start_reconciliation_session(uuid,uuid,uuid,date,date,numeric) to authenticated;
grant execute on function private.match_reconciliation_item(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function private.close_reconciliation_session(uuid,uuid,uuid) to authenticated;

revoke all on function public.create_bank_account(uuid,uuid,uuid,text,text,text) from public,anon;
revoke all on function public.record_manual_bank_transaction(uuid,uuid,uuid,date,text,numeric,text,text) from public,anon;
revoke all on function public.classify_bank_transaction(uuid,uuid,uuid,uuid,text) from public,anon;
revoke all on function public.start_reconciliation_session(uuid,uuid,uuid,date,date,numeric) from public,anon;
revoke all on function public.match_reconciliation_item(uuid,uuid,uuid,uuid) from public,anon;
revoke all on function public.close_reconciliation_session(uuid,uuid,uuid) from public,anon;
grant execute on function public.create_bank_account(uuid,uuid,uuid,text,text,text) to authenticated;
grant execute on function public.record_manual_bank_transaction(uuid,uuid,uuid,date,text,numeric,text,text) to authenticated;
grant execute on function public.classify_bank_transaction(uuid,uuid,uuid,uuid,text) to authenticated;
grant execute on function public.start_reconciliation_session(uuid,uuid,uuid,date,date,numeric) to authenticated;
grant execute on function public.match_reconciliation_item(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.close_reconciliation_session(uuid,uuid,uuid) to authenticated;

revoke all on function public.set_bank_provider_state_service(uuid,uuid,uuid,text,text,text,numeric,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.ingest_bank_transaction_service(uuid,uuid,uuid,text,date,text,text,numeric,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.set_bank_provider_state_service(uuid,uuid,uuid,text,text,text,numeric,timestamptz,jsonb) to service_role;
grant execute on function public.ingest_bank_transaction_service(uuid,uuid,uuid,text,date,text,text,numeric,text,text,jsonb,text) to service_role;

commit;