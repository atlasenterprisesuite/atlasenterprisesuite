create or replace function public.atlas_accounting_bank_self_check()
returns table(check_name text, passed boolean, detail text)
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  return query
  select 'accounting.bank.tables'::text,
         (select count(*)=4 from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname in ('bank_accounts','bank_transactions','reconciliation_sessions','reconciliation_items')),
         'bank/reconciliation tables exist'::text;

  return query
  select 'accounting.bank.rls'::text,
         (select count(*)=4 from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname in ('bank_accounts','bank_transactions','reconciliation_sessions','reconciliation_items') and c.relrowsecurity),
         'RLS enabled on all bank/reconciliation tables'::text;

  return query
  select 'accounting.bank.scope_not_null'::text,
         (select count(*)=8 from information_schema.columns
          where table_schema='public' and table_name in ('bank_accounts','bank_transactions','reconciliation_sessions','reconciliation_items')
            and column_name in ('tenant_id','org_id') and is_nullable='NO'),
         'tenant_id and org_id are mandatory across bank/reconciliation'::text;

  return query
  select 'accounting.bank.no_direct_client_writes'::text,
         not has_table_privilege('authenticated','public.bank_accounts','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.bank_transactions','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.reconciliation_sessions','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.reconciliation_items','INSERT,UPDATE,DELETE'),
         'authenticated has no direct bank/reconciliation DML'::text;

  return query
  select 'accounting.bank.source_immutable'::text,
         exists(select 1 from pg_trigger where tgrelid='public.bank_transactions'::regclass and tgname='bank_transactions_source_immutable_guard' and not tgisinternal),
         'bank source evidence has immutability trigger'::text;

  return query
  select 'accounting.bank.provider_truth'::text,
         exists(select 1 from pg_constraint where conrelid='public.bank_accounts'::regclass and conname='bank_accounts_provider_truth_ck'),
         'live provider state requires provider evidence'::text;

  return query
  select 'accounting.bank.service_only_provider'::text,
         has_function_privilege('service_role','public.set_bank_provider_state_service(uuid,uuid,uuid,text,text,text,numeric,timestamptz,jsonb)','EXECUTE')
         and not has_function_privilege('authenticated','public.set_bank_provider_state_service(uuid,uuid,uuid,text,text,text,numeric,timestamptz,jsonb)','EXECUTE')
         and has_function_privilege('service_role','public.ingest_bank_transaction_service(uuid,uuid,uuid,text,date,text,text,numeric,text,text,jsonb,text)','EXECUTE')
         and not has_function_privilege('authenticated','public.ingest_bank_transaction_service(uuid,uuid,uuid,text,date,text,text,numeric,text,text,jsonb,text)','EXECUTE'),
         'provider state and provider ingestion are service-role only'::text;

  return query
  select 'accounting.bank.public_rpc_invoker'::text,
         (select bool_and(not p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname in ('create_bank_account','record_manual_bank_transaction','classify_bank_transaction','start_reconciliation_session','match_reconciliation_item','close_reconciliation_session','set_bank_provider_state_service','ingest_bank_transaction_service')),
         'all public bank/reconciliation RPCs use SECURITY INVOKER'::text;

  return query
  select 'accounting.bank.reconciliation_ledger_link'::text,
         exists(select 1 from pg_constraint where conrelid='public.reconciliation_items'::regclass and conname='reconciliation_items_line_fk')
         and exists(select 1 from pg_constraint where conrelid='public.bank_accounts'::regclass and conname='bank_accounts_ledger_fk'),
         'reconciliation links bank accounts and items to ledger accounts/lines'::text;

  return query
  select 'accounting.bank.close_guards'::text,
         position('unmatched or exception items' in pg_get_functiondef('private.close_reconciliation_session(uuid,uuid,uuid)'::regprocedure))>0
         and position('does not equal ledger ending balance' in pg_get_functiondef('private.close_reconciliation_session(uuid,uuid,uuid)'::regprocedure))>0,
         'reconciliation close requires matched items and exact ending balance'::text;

  return query
  select 'accounting.bank.money_numeric'::text,
         (select count(*)>=4 from information_schema.columns
          where table_schema='public' and table_name in ('bank_accounts','bank_transactions','reconciliation_sessions','reconciliation_items')
            and column_name in ('reported_balance','amount','statement_ending_balance','variance') and data_type='numeric'),
         'bank/reconciliation amounts persist as numeric'::text;
end;
$$;

revoke all on function public.atlas_accounting_bank_self_check() from public,anon,authenticated;
grant execute on function public.atlas_accounting_bank_self_check() to service_role;