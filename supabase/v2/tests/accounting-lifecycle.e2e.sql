begin;

create temp table atlas_lifecycle_scope(user_id uuid primary key, tenant_id uuid, org_id uuid) on commit drop;
create temp table atlas_lifecycle_ids(key text primary key, val uuid not null) on commit drop;
grant select, update on atlas_lifecycle_scope to authenticated, service_role;
grant select, insert, update on atlas_lifecycle_ids to authenticated, service_role;

insert into atlas_lifecycle_scope(user_id) values (gen_random_uuid());
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
select user_id,'authenticated','authenticated','atlas-lifecycle-'||substr(replace(user_id::text,'-',''),1,12)||'@invalid.local','',
       '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now(),false,false
from atlas_lifecycle_scope;

set local role service_role;
update atlas_lifecycle_scope s
set (tenant_id,org_id)=(
  select b.tenant_id,b.organization_id
  from public.bootstrap_atlas_tenant_service(
    s.user_id,
    'ATLAS Lifecycle Tenant',
    'atlas-life-'||substr(replace(s.user_id::text,'-',''),1,12),
    'ATLAS Lifecycle Org',
    'atlas-life-org-'||substr(replace(s.user_id::text,'-',''),1,12)
  ) b
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from atlas_lifecycle_scope),true);
select set_config('request.jwt.claims',json_build_object('sub',(select user_id::text from atlas_lifecycle_scope),'role','authenticated')::text,true);

-- Chart of accounts + Accounting settings.
insert into atlas_lifecycle_ids values
('cash',(select public.create_accounting_account(tenant_id,org_id,'1000','Cash','asset','debit',false) from atlas_lifecycle_scope)),
('ar',(select public.create_accounting_account(tenant_id,org_id,'1100','Accounts Receivable','asset','debit',false) from atlas_lifecycle_scope)),
('fixed_asset',(select public.create_accounting_account(tenant_id,org_id,'1500','Equipment','asset','debit',false) from atlas_lifecycle_scope)),
('accum_dep',(select public.create_accounting_account(tenant_id,org_id,'1590','Accumulated Depreciation','asset','credit',false) from atlas_lifecycle_scope)),
('ap',(select public.create_accounting_account(tenant_id,org_id,'2000','Accounts Payable','liability','credit',false) from atlas_lifecycle_scope)),
('equity',(select public.create_accounting_account(tenant_id,org_id,'3000','Owner Equity','equity','credit',false) from atlas_lifecycle_scope)),
('revenue',(select public.create_accounting_account(tenant_id,org_id,'4000','Service Revenue','revenue','credit',false) from atlas_lifecycle_scope)),
('expense',(select public.create_accounting_account(tenant_id,org_id,'5000','Operating Expense','expense','debit',false) from atlas_lifecycle_scope)),
('dep_expense',(select public.create_accounting_account(tenant_id,org_id,'5100','Depreciation Expense','expense','debit',false) from atlas_lifecycle_scope));

select public.upsert_accounting_settings(
  s.tenant_id,s.org_id,'USD',1::smallint,1::smallint,
  (select val from atlas_lifecycle_ids where key='ar'),
  (select val from atlas_lifecycle_ids where key='ap')
) from atlas_lifecycle_scope s;

insert into atlas_lifecycle_ids
select 'period',public.create_accounting_period(tenant_id,org_id,date '2026-08-01',date '2026-08-31')
from atlas_lifecycle_scope;

-- Ledger: capitalization, posting, manual journal and reversal.
insert into atlas_lifecycle_ids
select 'capital_journal',public.create_accounting_journal_draft(tenant_id,org_id,'E2E-CAP-001',date '2026-08-01','Lifecycle capitalization','e2e','capital')
from atlas_lifecycle_scope;
select public.replace_accounting_journal_lines(
  s.tenant_id,s.org_id,(select val from atlas_lifecycle_ids where key='capital_journal'),
  jsonb_build_array(
    jsonb_build_object('account_id',(select val from atlas_lifecycle_ids where key='fixed_asset'),'description','Equipment capitalization','debit',1200,'credit',0),
    jsonb_build_object('account_id',(select val from atlas_lifecycle_ids where key='equity'),'description','Owner equity','debit',0,'credit',1200)
  )
) from atlas_lifecycle_scope s;
select public.post_accounting_journal(tenant_id,org_id,(select val from atlas_lifecycle_ids where key='capital_journal')) from atlas_lifecycle_scope;

insert into atlas_lifecycle_ids
select 'manual_journal',public.create_accounting_journal_draft(tenant_id,org_id,'E2E-MAN-001',date '2026-08-03','Manual expense','e2e','manual')
from atlas_lifecycle_scope;
select public.replace_accounting_journal_lines(
  s.tenant_id,s.org_id,(select val from atlas_lifecycle_ids where key='manual_journal'),
  jsonb_build_array(
    jsonb_build_object('account_id',(select val from atlas_lifecycle_ids where key='expense'),'description','Manual expense','debit',25,'credit',0),
    jsonb_build_object('account_id',(select val from atlas_lifecycle_ids where key='equity'),'description','Offset','debit',0,'credit',25)
  )
) from atlas_lifecycle_scope s;
select public.post_accounting_journal(tenant_id,org_id,(select val from atlas_lifecycle_ids where key='manual_journal')) from atlas_lifecycle_scope;
insert into atlas_lifecycle_ids
select 'reversal_journal',public.reverse_accounting_journal(
  tenant_id,org_id,(select val from atlas_lifecycle_ids where key='manual_journal'),'E2E-REV-001','Lifecycle reversal'
) from atlas_lifecycle_scope;

-- AR lifecycle.
insert into atlas_lifecycle_ids
select 'customer',public.create_accounting_customer(tenant_id,org_id,'C-001','Lifecycle Customer','customer@invalid.local','')
from atlas_lifecycle_scope;
insert into atlas_lifecycle_ids
select 'invoice',public.create_accounting_invoice_draft(
  tenant_id,org_id,(select val from atlas_lifecycle_ids where key='customer'),'INV-001',date '2026-08-05',date '2026-08-20','USD','Lifecycle invoice'
) from atlas_lifecycle_scope;
select public.replace_accounting_invoice_lines(
  s.tenant_id,s.org_id,(select val from atlas_lifecycle_ids where key='invoice'),
  jsonb_build_array(jsonb_build_object(
    'revenue_account_id',(select val from atlas_lifecycle_ids where key='revenue'),
    'description','Service','quantity',1,'unit_price',100,'tax_amount',0
  ))
) from atlas_lifecycle_scope s;
insert into atlas_lifecycle_ids
select 'invoice_journal',public.post_accounting_invoice(tenant_id,org_id,(select val from atlas_lifecycle_ids where key='invoice'))
from atlas_lifecycle_scope;
insert into atlas_lifecycle_ids
select 'customer_payment',public.create_customer_payment_draft(
  tenant_id,org_id,
  (select val from atlas_lifecycle_ids where key='customer'),
  (select val from atlas_lifecycle_ids where key='invoice'),
  (select val from atlas_lifecycle_ids where key='cash'),100,date '2026-08-10','USD','AR-E2E'
) from atlas_lifecycle_scope;
insert into atlas_lifecycle_ids
select 'customer_payment_journal',public.post_customer_payment(tenant_id,org_id,(select val from atlas_lifecycle_ids where key='customer_payment'))
from atlas_lifecycle_scope;

-- AP lifecycle.
insert into atlas_lifecycle_ids
select 'vendor',public.create_accounting_vendor(tenant_id,org_id,'V-001','Lifecycle Vendor','vendor@invalid.local','')
from atlas_lifecycle_scope;
insert into atlas_lifecycle_ids
select 'bill',public.create_accounting_bill_draft(
  tenant_id,org_id,(select val from atlas_lifecycle_ids where key='vendor'),'BILL-001',date '2026-08-06',date '2026-08-21','USD','Lifecycle bill'
) from atlas_lifecycle_scope;
select public.replace_accounting_bill_lines(
  s.tenant_id,s.org_id,(select val from atlas_lifecycle_ids where key='bill'),
  jsonb_build_array(jsonb_build_object(
    'expense_account_id',(select val from atlas_lifecycle_ids where key='expense'),
    'description','Vendor service','quantity',1,'unit_price',60,'tax_amount',0
  ))
) from atlas_lifecycle_scope s;
select public.approve_accounting_bill(tenant_id,org_id,(select val from atlas_lifecycle_ids where key='bill')) from atlas_lifecycle_scope;
insert into atlas_lifecycle_ids
select 'bill_journal',public.post_accounting_bill(tenant_id,org_id,(select val from atlas_lifecycle_ids where key='bill'))
from atlas_lifecycle_scope;
insert into atlas_lifecycle_ids
select 'vendor_payment',public.create_vendor_payment_draft(
  tenant_id,org_id,
  (select val from atlas_lifecycle_ids where key='vendor'),
  (select val from atlas_lifecycle_ids where key='bill'),
  (select val from atlas_lifecycle_ids where key='cash'),60,date '2026-08-12','USD','AP-E2E'
) from atlas_lifecycle_scope;
insert into atlas_lifecycle_ids
select 'vendor_payment_journal',public.post_vendor_payment(tenant_id,org_id,(select val from atlas_lifecycle_ids where key='vendor_payment'))
from atlas_lifecycle_scope;

-- Bank + reconciliation.
insert into atlas_lifecycle_ids
select 'bank',public.create_bank_account(
  tenant_id,org_id,(select val from atlas_lifecycle_ids where key='cash'),'Lifecycle Checking','Synthetic Bank','USD'
) from atlas_lifecycle_scope;
insert into atlas_lifecycle_ids
select 'bank_in',public.record_manual_bank_transaction(
  tenant_id,org_id,(select val from atlas_lifecycle_ids where key='bank'),date '2026-08-10','Customer receipt',100,'USD','Lifecycle Customer'
) from atlas_lifecycle_scope;
insert into atlas_lifecycle_ids
select 'bank_out',public.record_manual_bank_transaction(
  tenant_id,org_id,(select val from atlas_lifecycle_ids where key='bank'),date '2026-08-12','Vendor payment',-60,'USD','Lifecycle Vendor'
) from atlas_lifecycle_scope;
insert into atlas_lifecycle_ids
select 'recon',public.start_reconciliation_session(
  tenant_id,org_id,(select val from atlas_lifecycle_ids where key='bank'),date '2026-08-01',date '2026-08-31',40
) from atlas_lifecycle_scope;
insert into atlas_lifecycle_ids
select 'recon_in_item',ri.id from public.reconciliation_items ri
where ri.session_id=(select val from atlas_lifecycle_ids where key='recon')
  and ri.bank_transaction_id=(select val from atlas_lifecycle_ids where key='bank_in');
insert into atlas_lifecycle_ids
select 'recon_out_item',ri.id from public.reconciliation_items ri
where ri.session_id=(select val from atlas_lifecycle_ids where key='recon')
  and ri.bank_transaction_id=(select val from atlas_lifecycle_ids where key='bank_out');
insert into atlas_lifecycle_ids
select 'cash_in_line',jl.id from public.journal_lines jl
where jl.journal_entry_id=(select val from atlas_lifecycle_ids where key='customer_payment_journal')
  and jl.account_id=(select val from atlas_lifecycle_ids where key='cash');
insert into atlas_lifecycle_ids
select 'cash_out_line',jl.id from public.journal_lines jl
where jl.journal_entry_id=(select val from atlas_lifecycle_ids where key='vendor_payment_journal')
  and jl.account_id=(select val from atlas_lifecycle_ids where key='cash');
select public.match_reconciliation_item(
  tenant_id,org_id,
  (select val from atlas_lifecycle_ids where key='recon_in_item'),
  (select val from atlas_lifecycle_ids where key='cash_in_line')
) from atlas_lifecycle_scope;
select public.match_reconciliation_item(
  tenant_id,org_id,
  (select val from atlas_lifecycle_ids where key='recon_out_item'),
  (select val from atlas_lifecycle_ids where key='cash_out_line')
) from atlas_lifecycle_scope;
select public.close_reconciliation_session(tenant_id,org_id,(select val from atlas_lifecycle_ids where key='recon')) from atlas_lifecycle_scope;

-- Fixed asset + depreciation.
insert into atlas_lifecycle_ids
select 'asset',public.create_fixed_asset(
  tenant_id,org_id,'FA-001','Lifecycle Equipment','Synthetic lifecycle asset',date '2026-08-01',1200,0,12,
  (select val from atlas_lifecycle_ids where key='fixed_asset'),
  (select val from atlas_lifecycle_ids where key='accum_dep'),
  (select val from atlas_lifecycle_ids where key='dep_expense')
) from atlas_lifecycle_scope;
insert into atlas_lifecycle_ids
select 'depreciation_journal',public.post_asset_depreciation(
  tenant_id,org_id,(select val from atlas_lifecycle_ids where key='asset'),date '2026-08-31'
) from atlas_lifecycle_scope;

-- Close, closed-period guard, reopen and re-close.
insert into atlas_lifecycle_ids
select 'close_task',public.create_accounting_close_task(
  tenant_id,org_id,(select val from atlas_lifecycle_ids where key='period'),
  'review-ledger','Review ledger','ledger',(select user_id from atlas_lifecycle_scope),now(),1
) from atlas_lifecycle_scope;
select public.complete_accounting_close_task(
  tenant_id,org_id,(select val from atlas_lifecycle_ids where key='close_task'),'{"reviewed":true,"source":"e2e"}'::jsonb
) from atlas_lifecycle_scope;
select public.close_accounting_period(tenant_id,org_id,(select val from atlas_lifecycle_ids where key='period')) from atlas_lifecycle_scope;

insert into atlas_lifecycle_ids
select 'closed_period_journal',public.create_accounting_journal_draft(
  tenant_id,org_id,'E2E-CLOSED-001',date '2026-08-20','Closed-period guard','e2e','closed'
) from atlas_lifecycle_scope;
select public.replace_accounting_journal_lines(
  s.tenant_id,s.org_id,(select val from atlas_lifecycle_ids where key='closed_period_journal'),
  jsonb_build_array(
    jsonb_build_object('account_id',(select val from atlas_lifecycle_ids where key='expense'),'description','Closed-period expense','debit',10,'credit',0),
    jsonb_build_object('account_id',(select val from atlas_lifecycle_ids where key='equity'),'description','Closed-period offset','debit',0,'credit',10)
  )
) from atlas_lifecycle_scope s;

do $$
declare
  s record;
  blocked boolean:=false;
begin
  select * into s from atlas_lifecycle_scope;
  begin
    perform public.post_accounting_journal(s.tenant_id,s.org_id,(select val from atlas_lifecycle_ids where key='closed_period_journal'));
  exception when others then
    blocked:=true;
  end;
  if not blocked then raise exception 'Closed period unexpectedly allowed posting'; end if;
end $$;

select public.reopen_accounting_period(
  tenant_id,org_id,(select val from atlas_lifecycle_ids where key='period'),'E2E reopen to validate lifecycle'
) from atlas_lifecycle_scope;
select public.post_accounting_journal(tenant_id,org_id,(select val from atlas_lifecycle_ids where key='closed_period_journal')) from atlas_lifecycle_scope;
select public.close_accounting_period(tenant_id,org_id,(select val from atlas_lifecycle_ids where key='period')) from atlas_lifecycle_scope;

-- Final lifecycle and financial-report assertions.
do $$
declare
  s record;
  tb_debits numeric;
  tb_credits numeric;
  pnl_revenue numeric;
  pnl_expense numeric;
  bs_assets numeric;
  bs_liab_equity numeric;
  gl_rows integer;
begin
  select * into s from atlas_lifecycle_scope;

  if (select status from public.invoices where id=(select val from atlas_lifecycle_ids where key='invoice')) <> 'paid' then raise exception 'Invoice lifecycle did not end paid'; end if;
  if (select status from public.bills where id=(select val from atlas_lifecycle_ids where key='bill')) <> 'paid' then raise exception 'Bill lifecycle did not end paid'; end if;
  if (select status from public.reconciliation_sessions where id=(select val from atlas_lifecycle_ids where key='recon')) <> 'closed' then raise exception 'Reconciliation did not close'; end if;
  if (select status from public.accounting_periods where id=(select val from atlas_lifecycle_ids where key='period')) <> 'closed' then raise exception 'Accounting period did not re-close'; end if;
  if (select status from public.journal_entries where id=(select val from atlas_lifecycle_ids where key='manual_journal')) <> 'reversed' then raise exception 'Original journal not marked reversed'; end if;
  if (select status from public.journal_entries where id=(select val from atlas_lifecycle_ids where key='reversal_journal')) <> 'posted' then raise exception 'Reversal journal not posted'; end if;
  if (select amount from public.asset_depreciation_events where asset_id=(select val from atlas_lifecycle_ids where key='asset') and depreciation_date=date '2026-08-31') <> 100 then raise exception 'Depreciation amount mismatch'; end if;

  select sum(tb.total_debit),sum(tb.total_credit)
    into tb_debits,tb_credits
  from public.accounting_trial_balance(s.tenant_id,s.org_id,date '2026-08-31') tb;
  if tb_debits is distinct from tb_credits then raise exception 'Trial balance not balanced: % vs %',tb_debits,tb_credits; end if;

  select
    coalesce(sum(pl.amount) filter(where pl.account_type='revenue'),0),
    coalesce(sum(pl.amount) filter(where pl.account_type='expense'),0)
  into pnl_revenue,pnl_expense
  from public.accounting_profit_and_loss(s.tenant_id,s.org_id,date '2026-08-01',date '2026-08-31') pl;
  if pnl_revenue <> 100 then raise exception 'P&L revenue mismatch: %',pnl_revenue; end if;
  if pnl_expense <> 195 then raise exception 'P&L expense mismatch: %',pnl_expense; end if;

  select
    coalesce(sum(bs.amount) filter(where bs.account_type='asset'),0),
    coalesce(sum(bs.amount) filter(where bs.account_type in ('liability','equity')),0)
  into bs_assets,bs_liab_equity
  from public.accounting_balance_sheet(s.tenant_id,s.org_id,date '2026-08-31') bs;
  if bs_assets <> bs_liab_equity then raise exception 'Balance sheet mismatch: assets %, liabilities+equity %',bs_assets,bs_liab_equity; end if;

  select count(*) into gl_rows
  from public.accounting_general_ledger(s.tenant_id,s.org_id,date '2026-08-01',date '2026-08-31');
  if gl_rows < 10 then raise exception 'General ledger unexpectedly sparse: % rows',gl_rows; end if;
end $$;

reset role;
rollback;
