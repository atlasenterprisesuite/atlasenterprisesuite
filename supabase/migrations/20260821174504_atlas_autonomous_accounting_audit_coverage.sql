do $migration$
declare
  t text;
begin
  foreach t in array array[
    'accounting_bank_accounts',
    'accounting_bills',
    'accounting_close_tasks',
    'accounting_entities',
    'accounting_forecast_snapshots',
    'accounting_integrations',
    'accounting_periods',
    'accounting_reconciliation_items',
    'accounting_reconciliation_sessions',
    'accounting_review_queue',
    'accounting_tax_readiness_tasks',
    'accounting_transaction_reviews',
    'accounting_transaction_rules',
    'accounting_transactions'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'atlas_audit_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      'atlas_audit_' || t,
      t
    );
  end loop;
end;
$migration$;
