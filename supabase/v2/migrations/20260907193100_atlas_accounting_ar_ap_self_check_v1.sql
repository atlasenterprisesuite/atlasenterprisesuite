create or replace function public.atlas_accounting_arap_self_check()
returns table(check_name text, passed boolean, detail text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  return query
  select 'accounting.arap.tables'::text,
         (select count(*)=8 from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname in ('customers','vendors','invoices','invoice_lines','customer_payments','bills','bill_lines','vendor_payments')),
         'all AR/AP tables exist'::text;

  return query
  select 'accounting.arap.rls'::text,
         (select count(*)=8 from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname in ('customers','vendors','invoices','invoice_lines','customer_payments','bills','bill_lines','vendor_payments') and c.relrowsecurity),
         'RLS enabled on all AR/AP tables'::text;

  return query
  select 'accounting.arap.scope_not_null'::text,
         (select count(*)=16 from information_schema.columns
          where table_schema='public' and table_name in ('customers','vendors','invoices','invoice_lines','customer_payments','bills','bill_lines','vendor_payments')
            and column_name in ('tenant_id','org_id') and is_nullable='NO'),
         'tenant_id and org_id are mandatory across AR/AP'::text;

  return query
  select 'accounting.arap.scope_fks'::text,
         (select count(*)=8 from pg_constraint con join pg_class rel on rel.oid=con.conrelid join pg_namespace n on n.oid=rel.relnamespace
          where n.nspname='public' and rel.relname in ('customers','vendors','invoices','invoice_lines','customer_payments','bills','bill_lines','vendor_payments')
            and con.contype='f' and con.confrelid='public.organizations'::regclass),
         'every AR/AP table references organizations'::text;

  return query
  select 'accounting.arap.no_direct_client_writes'::text,
         not has_table_privilege('authenticated','public.customers','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.vendors','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.invoices','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.invoice_lines','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.customer_payments','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.bills','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.bill_lines','INSERT,UPDATE,DELETE')
         and not has_table_privilege('authenticated','public.vendor_payments','INSERT,UPDATE,DELETE'),
         'authenticated has no direct AR/AP DML'::text;

  return query
  select 'accounting.arap.public_rpc_invoker'::text,
         (select bool_and(not p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname in (
            'create_accounting_customer','create_accounting_vendor','create_accounting_invoice_draft','replace_accounting_invoice_lines','post_accounting_invoice',
            'create_accounting_bill_draft','replace_accounting_bill_lines','approve_accounting_bill','post_accounting_bill',
            'create_customer_payment_draft','post_customer_payment','create_vendor_payment_draft','post_vendor_payment')),
         'all public AR/AP wrappers use SECURITY INVOKER'::text;

  return query
  select 'accounting.arap.auth_grants'::text,
         has_function_privilege('authenticated','public.post_accounting_invoice(uuid,uuid,uuid)','EXECUTE')
         and has_function_privilege('authenticated','public.approve_accounting_bill(uuid,uuid,uuid)','EXECUTE')
         and has_function_privilege('authenticated','public.post_accounting_bill(uuid,uuid,uuid)','EXECUTE')
         and has_function_privilege('authenticated','public.post_customer_payment(uuid,uuid,uuid)','EXECUTE')
         and has_function_privilege('authenticated','public.post_vendor_payment(uuid,uuid,uuid)','EXECUTE')
         and not has_function_privilege('anon','public.post_accounting_invoice(uuid,uuid,uuid)','EXECUTE'),
         'AR/AP governed RPCs are authenticated-only'::text;

  return query
  select 'accounting.arap.ledger_links'::text,
         exists(select 1 from pg_constraint where conrelid='public.invoices'::regclass and conname='invoices_journal_fk')
         and exists(select 1 from pg_constraint where conrelid='public.bills'::regclass and conname='bills_journal_fk')
         and exists(select 1 from pg_constraint where conrelid='public.customer_payments'::regclass and conname='customer_payments_journal_fk')
         and exists(select 1 from pg_constraint where conrelid='public.vendor_payments'::regclass and conname='vendor_payments_journal_fk'),
         'subledger postings link back to governed journals'::text;

  return query
  select 'accounting.arap.bill_approval_guard'::text,
         position('Bill must be approved before posting' in pg_get_functiondef('private.post_accounting_bill(uuid,uuid,uuid)'::regprocedure)) > 0,
         'bill posting requires explicit approval'::text;

  return query
  select 'accounting.arap.overpayment_guards'::text,
         position('exceeds outstanding balance' in pg_get_functiondef('private.post_customer_payment(uuid,uuid,uuid)'::regprocedure)) > 0
         and position('exceeds outstanding balance' in pg_get_functiondef('private.post_vendor_payment(uuid,uuid,uuid)'::regprocedure)) > 0,
         'customer and vendor payments reject overpayment'::text;

  return query
  select 'accounting.arap.tax_fail_closed'::text,
         position('Tax posting is not configured' in pg_get_functiondef('private.post_accounting_invoice(uuid,uuid,uuid)'::regprocedure)) > 0
         and position('Tax posting is not configured' in pg_get_functiondef('private.post_accounting_bill(uuid,uuid,uuid)'::regprocedure)) > 0,
         'tax amounts fail closed until governed tax posting exists'::text;

  return query
  select 'accounting.arap.money_numeric'::text,
         (select count(*)>=8 from information_schema.columns
          where table_schema='public' and table_name in ('invoice_lines','bill_lines','customer_payments','vendor_payments')
            and column_name in ('quantity','unit_price','tax_amount','line_total','amount') and data_type='numeric'),
         'AR/AP monetary values persist as numeric'::text;
end;
$$;

revoke all on function public.atlas_accounting_arap_self_check() from public,anon,authenticated;
grant execute on function public.atlas_accounting_arap_self_check() to service_role;