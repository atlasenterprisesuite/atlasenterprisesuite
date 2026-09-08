create or replace function public.atlas_accounting_self_check()
returns table(check_name text, passed boolean, detail text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  return query
  select 'accounting.tables'::text,
         (to_regclass('public.accounting_settings') is not null
          and to_regclass('public.chart_of_accounts') is not null
          and to_regclass('public.journal_entries') is not null
          and to_regclass('public.journal_lines') is not null),
         'ledger core tables exist'::text;

  return query
  select 'accounting.rls'::text,
         (select count(*) = 4
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname='public'
            and c.relname in ('accounting_settings','chart_of_accounts','journal_entries','journal_lines')
            and c.relrowsecurity),
         'RLS enabled on all ledger core tables'::text;

  return query
  select 'accounting.scope_not_null'::text,
         (select count(*) = 8
          from information_schema.columns
          where table_schema='public'
            and table_name in ('accounting_settings','chart_of_accounts','journal_entries','journal_lines')
            and column_name in ('tenant_id','org_id')
            and is_nullable='NO'),
         'tenant_id and org_id are mandatory on all ledger core tables'::text;

  return query
  select 'accounting.scope_fks'::text,
         (select count(*) = 4
          from pg_constraint con
          join pg_class rel on rel.oid=con.conrelid
          join pg_namespace n on n.oid=rel.relnamespace
          where n.nspname='public'
            and rel.relname in ('accounting_settings','chart_of_accounts','journal_entries','journal_lines')
            and con.contype='f'
            and con.confrelid='public.organizations'::regclass),
         'every ledger core table references organizations'::text;

  return query
  select 'accounting.no_direct_client_writes'::text,
         not has_table_privilege('authenticated','public.accounting_settings','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.chart_of_accounts','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.journal_entries','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.journal_lines','INSERT,UPDATE,DELETE'),
         'authenticated has SELECT only on ledger core tables'::text;

  return query
  select 'accounting.public_rpc_invoker'::text,
         (select bool_and(not p.prosecdef)
          from pg_proc p
          join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public'
            and p.proname in (
              'upsert_accounting_settings','create_accounting_account','update_accounting_account',
              'create_accounting_journal_draft','replace_accounting_journal_lines',
              'post_accounting_journal','reverse_accounting_journal'
            )),
         'all public accounting RPC wrappers use SECURITY INVOKER'::text;

  return query
  select 'accounting.rpc_auth_grants'::text,
         has_function_privilege('authenticated','public.create_accounting_account(uuid,uuid,text,text,text,text,boolean)','EXECUTE')
         and has_function_privilege('authenticated','public.create_accounting_journal_draft(uuid,uuid,text,date,text,text,text)','EXECUTE')
         and has_function_privilege('authenticated','public.post_accounting_journal(uuid,uuid,uuid)','EXECUTE')
         and has_function_privilege('authenticated','public.reverse_accounting_journal(uuid,uuid,uuid,text,text)','EXECUTE')
         and not has_function_privilege('anon','public.post_accounting_journal(uuid,uuid,uuid)','EXECUTE'),
         'governed accounting RPCs are authenticated-only'::text;

  return query
  select 'accounting.journal_constraints'::text,
         exists(select 1 from pg_constraint where conrelid='public.journal_lines'::regclass and conname='journal_lines_side_ck')
         and exists(select 1 from pg_constraint where conrelid='public.journal_entries'::regclass and conname='journal_entries_post_state_ck'),
         'journal side and posting-state constraints exist'::text;

  return query
  select 'accounting.immutability_triggers'::text,
         exists(select 1 from pg_trigger where tgrelid='public.journal_entries'::regclass and tgname='journal_entries_immutable_guard' and not tgisinternal)
         and exists(select 1 from pg_trigger where tgrelid='public.journal_lines'::regclass and tgname='journal_lines_immutable_guard' and not tgisinternal),
         'posted journal header and line immutability guards exist'::text;

  return query
  select 'accounting.money_numeric'::text,
         (select count(*) = 2
          from information_schema.columns
          where table_schema='public' and table_name='journal_lines'
            and column_name in ('debit','credit') and data_type='numeric'),
         'journal debit and credit persist as numeric'::text;

  return query
  select 'accounting.permissions'::text,
         (select count(*) = 6 from public.identity_permissions where code in (
           'accounting.read','accounting.write','accounting.post','accounting.approve','accounting.close','accounting.admin'
         )),
         'complete accounting permission catalog exists'::text;

  return query
  select 'accounting.module_registry'::text,
         exists(select 1 from public.module_registry where code='accounting' and status='available'),
         'ATLAS Accounting is registered as an available module'::text;
end;
$$;

revoke all on function public.atlas_accounting_self_check() from public, anon, authenticated;
grant execute on function public.atlas_accounting_self_check() to service_role;