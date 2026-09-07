create or replace function public.atlas_accounting_assets_close_self_check()
returns table(check_name text, passed boolean, detail text)
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  return query
  select 'accounting.final.tables'::text,
         (select count(*)=4 from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname in ('fixed_assets','asset_depreciation_events','accounting_periods','accounting_close_tasks')),
         'assets and close tables exist'::text;

  return query
  select 'accounting.final.rls'::text,
         (select count(*)=4 from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname in ('fixed_assets','asset_depreciation_events','accounting_periods','accounting_close_tasks') and c.relrowsecurity),
         'RLS enabled on assets and close tables'::text;

  return query
  select 'accounting.final.scope_not_null'::text,
         (select count(*)=8 from information_schema.columns
          where table_schema='public' and table_name in ('fixed_assets','asset_depreciation_events','accounting_periods','accounting_close_tasks')
            and column_name in ('tenant_id','org_id') and is_nullable='NO'),
         'tenant_id and org_id are mandatory across assets/close'::text;

  return query
  select 'accounting.final.no_direct_client_writes'::text,
         not has_table_privilege('authenticated','public.fixed_assets','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.asset_depreciation_events','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.accounting_periods','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.accounting_close_tasks','INSERT,UPDATE,DELETE'),
         'authenticated has no direct assets/close DML'::text;

  return query
  select 'accounting.final.asset_ledger_links'::text,
         exists(select 1 from pg_constraint where conrelid='public.fixed_assets'::regclass and conname='fixed_assets_asset_account_fk')
         and exists(select 1 from pg_constraint where conrelid='public.fixed_assets'::regclass and conname='fixed_assets_accum_account_fk')
         and exists(select 1 from pg_constraint where conrelid='public.fixed_assets'::regclass and conname='fixed_assets_expense_account_fk')
         and exists(select 1 from pg_constraint where conrelid='public.asset_depreciation_events'::regclass and conname='asset_depreciation_events_journal_fk'),
         'fixed assets and depreciation events are linked to ledger accounts/journals'::text;

  return query
  select 'accounting.final.no_free_accumulated_balance'::text,
         not exists(select 1 from information_schema.columns where table_schema='public' and table_name='fixed_assets' and column_name='accumulated_depreciation'),
         'accumulated depreciation is derived from governed events/postings'::text;

  return query
  select 'accounting.final.depreciation_guards'::text,
         position('Depreciation date must be month end' in pg_get_functiondef('private.post_asset_depreciation(uuid,uuid,uuid,date)'::regprocedure))>0
         and position('Asset is fully depreciated' in pg_get_functiondef('private.post_asset_depreciation(uuid,uuid,uuid,date)'::regprocedure))>0
         and position('post_accounting_journal' in pg_get_functiondef('private.post_asset_depreciation(uuid,uuid,uuid,date)'::regprocedure))>0,
         'straight-line depreciation is capped and posted through the ledger'::text;

  return query
  select 'accounting.final.period_guards'::text,
         position('Accounting periods cannot overlap' in pg_get_functiondef('private.create_accounting_period(uuid,uuid,date,date)'::regprocedure))>0
         and position('incomplete close tasks' in pg_get_functiondef('private.close_accounting_period(uuid,uuid,uuid)'::regprocedure))>0
         and position('draft journal entries' in pg_get_functiondef('private.close_accounting_period(uuid,uuid,uuid)'::regprocedure))>0
         and position('open reconciliation sessions' in pg_get_functiondef('private.close_accounting_period(uuid,uuid,uuid)'::regprocedure))>0,
         'period creation/close rejects overlap and unresolved close blockers'::text;

  return query
  select 'accounting.final.reopen_guard'::text,
         position('accounting.admin' in pg_get_functiondef('private.reopen_accounting_period(uuid,uuid,uuid,text)'::regprocedure))>0
         and position('Reopen reason is required' in pg_get_functiondef('private.reopen_accounting_period(uuid,uuid,uuid,text)'::regprocedure))>0,
         'reopening requires accounting.admin and an explicit reason'::text;

  return query
  select 'accounting.final.report_functions'::text,
         to_regprocedure('public.accounting_trial_balance(uuid,uuid,date)') is not null
         and to_regprocedure('public.accounting_general_ledger(uuid,uuid,date,date)') is not null
         and to_regprocedure('public.accounting_profit_and_loss(uuid,uuid,date,date)') is not null
         and to_regprocedure('public.accounting_balance_sheet(uuid,uuid,date)') is not null,
         'Trial Balance, GL, P&L and Balance Sheet functions exist'::text;

  return query
  select 'accounting.final.reports_invoker_auth_only'::text,
         (select bool_and(not p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname in ('accounting_trial_balance','accounting_general_ledger','accounting_profit_and_loss','accounting_balance_sheet'))
         and has_function_privilege('authenticated','public.accounting_trial_balance(uuid,uuid,date)','EXECUTE')
         and not has_function_privilege('anon','public.accounting_trial_balance(uuid,uuid,date)','EXECUTE'),
         'financial reports are authenticated SECURITY INVOKER functions'::text;

  return query
  select 'accounting.final.report_ledger_truth'::text,
         position('journal_lines' in pg_get_functiondef('public.accounting_trial_balance(uuid,uuid,date)'::regprocedure))>0
         and position('journal_lines' in pg_get_functiondef('public.accounting_profit_and_loss(uuid,uuid,date,date)'::regprocedure))>0
         and position('CURRENT-EARNINGS' in pg_get_functiondef('public.accounting_balance_sheet(uuid,uuid,date)'::regprocedure))>0,
         'reports derive from journal lines and balance sheet includes current earnings'::text;

  return query
  select 'accounting.final.money_numeric'::text,
         (select count(*)>=4 from information_schema.columns
          where table_schema='public' and table_name in ('fixed_assets','asset_depreciation_events','accounting_close_tasks')
            and column_name in ('cost','salvage_value','amount','weight') and data_type='numeric'),
         'asset and close numeric values use numeric persistence'::text;
end;
$$;

revoke all on function public.atlas_accounting_assets_close_self_check() from public,anon,authenticated;
grant execute on function public.atlas_accounting_assets_close_self_check() to service_role;