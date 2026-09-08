begin;

create or replace function private.require_base_currency(
  p_tenant_id uuid,
  p_org_id uuid,
  p_currency text
) returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_currency text := upper(btrim(p_currency));
  v_base text;
begin
  select base_currency into v_base
  from public.accounting_settings
  where tenant_id=p_tenant_id and org_id=p_org_id;
  if v_base is null then raise exception 'Accounting settings must be configured first'; end if;
  if v_currency <> v_base then raise exception 'Currency % does not match organization base currency %', v_currency, v_base; end if;
  return v_currency;
end;
$$;

create or replace function private.create_accounting_customer(
  p_tenant_id uuid, p_org_id uuid, p_customer_number text, p_name text, p_email text, p_phone text
) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_id uuid; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.write');
  insert into public.customers(tenant_id,org_id,customer_number,name,email,phone,created_by)
  values(p_tenant_id,p_org_id,btrim(p_customer_number),btrim(p_name),nullif(btrim(coalesce(p_email,'')),''),nullif(btrim(coalesce(p_phone,'')),''),auth.uid())
  returning id into v_id;
  select to_jsonb(c) into v_after from public.customers c where id=v_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.customer.create','customers',v_id::text,null,v_after);
  return v_id;
end;
$$;

create or replace function private.create_accounting_vendor(
  p_tenant_id uuid, p_org_id uuid, p_vendor_number text, p_name text, p_email text, p_phone text
) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_id uuid; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.write');
  insert into public.vendors(tenant_id,org_id,vendor_number,name,email,phone,created_by)
  values(p_tenant_id,p_org_id,btrim(p_vendor_number),btrim(p_name),nullif(btrim(coalesce(p_email,'')),''),nullif(btrim(coalesce(p_phone,'')),''),auth.uid())
  returning id into v_id;
  select to_jsonb(v) into v_after from public.vendors v where id=v_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.vendor.create','vendors',v_id::text,null,v_after);
  return v_id;
end;
$$;

create or replace function private.create_accounting_invoice_draft(
  p_tenant_id uuid, p_org_id uuid, p_customer_id uuid, p_invoice_number text,
  p_issue_date date, p_due_date date, p_currency text, p_memo text
) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_id uuid; v_after jsonb; v_currency text;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.write');
  v_currency := private.require_base_currency(p_tenant_id,p_org_id,p_currency);
  if not exists(select 1 from public.customers where id=p_customer_id and tenant_id=p_tenant_id and org_id=p_org_id and status='active') then
    raise exception 'Active customer not found in scope';
  end if;
  insert into public.invoices(tenant_id,org_id,customer_id,invoice_number,issue_date,due_date,currency,memo,created_by)
  values(p_tenant_id,p_org_id,p_customer_id,btrim(p_invoice_number),p_issue_date,p_due_date,v_currency,nullif(btrim(coalesce(p_memo,'')),''),auth.uid())
  returning id into v_id;
  select to_jsonb(i) into v_after from public.invoices i where id=v_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.invoice.create_draft','invoices',v_id::text,null,v_after);
  return v_id;
end;
$$;

create or replace function private.replace_accounting_invoice_lines(
  p_tenant_id uuid, p_org_id uuid, p_invoice_id uuid, p_lines jsonb
) returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_status text; v_row jsonb; v_line_no integer:=0; v_account uuid; v_before jsonb; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.write');
  select status into v_status from public.invoices where id=p_invoice_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_status is null then raise exception 'Invoice not found in scope'; end if;
  if v_status <> 'draft' then raise exception 'Only draft invoices can change lines'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 1 then raise exception 'At least one invoice line is required'; end if;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.line_number),'[]'::jsonb) into v_before from public.invoice_lines l where invoice_id=p_invoice_id;
  delete from public.invoice_lines where invoice_id=p_invoice_id and tenant_id=p_tenant_id and org_id=p_org_id;
  for v_row in select value from jsonb_array_elements(p_lines) loop
    v_line_no:=v_line_no+1;
    v_account:=(v_row->>'revenue_account_id')::uuid;
    if not exists(select 1 from public.chart_of_accounts where id=v_account and tenant_id=p_tenant_id and org_id=p_org_id and active and account_type='revenue') then
      raise exception 'Revenue account % is not an active revenue account in scope', v_account;
    end if;
    insert into public.invoice_lines(tenant_id,org_id,invoice_id,line_number,revenue_account_id,description,quantity,unit_price,tax_amount)
    values(p_tenant_id,p_org_id,p_invoice_id,v_line_no,v_account,btrim(v_row->>'description'),coalesce((v_row->>'quantity')::numeric,1),(v_row->>'unit_price')::numeric,coalesce((v_row->>'tax_amount')::numeric,0));
  end loop;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.line_number),'[]'::jsonb) into v_after from public.invoice_lines l where invoice_id=p_invoice_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.invoice.replace_lines','invoices',p_invoice_id::text,v_before,v_after);
end;
$$;

create or replace function private.post_accounting_invoice(
  p_tenant_id uuid, p_org_id uuid, p_invoice_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype; v_ar uuid; v_count integer; v_total numeric(30,4); v_tax numeric(30,4);
  v_journal uuid; v_line_no integer:=1; v_line record; v_before jsonb; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.post');
  select * into v_invoice from public.invoices where id=p_invoice_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_invoice.id is null then raise exception 'Invoice not found in scope'; end if;
  if v_invoice.status <> 'draft' then raise exception 'Only draft invoices can be posted'; end if;
  perform private.require_base_currency(p_tenant_id,p_org_id,v_invoice.currency);
  select default_ar_account_id into v_ar from public.accounting_settings where tenant_id=p_tenant_id and org_id=p_org_id;
  if v_ar is null then raise exception 'Default AR account is not configured'; end if;
  if not exists(select 1 from public.chart_of_accounts where id=v_ar and tenant_id=p_tenant_id and org_id=p_org_id and active and account_type='asset') then raise exception 'Default AR account must be an active asset account'; end if;
  select count(*),coalesce(sum(line_total),0),coalesce(sum(tax_amount),0) into v_count,v_total,v_tax from public.invoice_lines where invoice_id=p_invoice_id and tenant_id=p_tenant_id and org_id=p_org_id;
  if v_count<1 or v_total<=0 then raise exception 'Invoice must contain positive lines'; end if;
  if v_tax<>0 then raise exception 'Tax posting is not configured in Accounting v1; tax_amount must be zero'; end if;
  v_journal:=private.create_accounting_journal_draft(p_tenant_id,p_org_id,'AR-INV-'||v_invoice.invoice_number,v_invoice.issue_date,'Invoice '||v_invoice.invoice_number,'invoice',p_invoice_id::text);
  insert into public.journal_lines(tenant_id,org_id,journal_entry_id,line_number,account_id,description,debit,credit)
  values(p_tenant_id,p_org_id,v_journal,1,v_ar,'Accounts receivable - '||v_invoice.invoice_number,v_total,0);
  for v_line in select * from public.invoice_lines where invoice_id=p_invoice_id order by line_number loop
    v_line_no:=v_line_no+1;
    insert into public.journal_lines(tenant_id,org_id,journal_entry_id,line_number,account_id,description,debit,credit)
    values(p_tenant_id,p_org_id,v_journal,v_line_no,v_line.revenue_account_id,v_line.description,0,v_line.line_total);
  end loop;
  perform private.post_accounting_journal(p_tenant_id,p_org_id,v_journal);
  v_before:=to_jsonb(v_invoice);
  update public.invoices set status='open',posted_journal_id=v_journal,posted_by=auth.uid(),posted_at=now(),updated_at=now() where id=p_invoice_id;
  select to_jsonb(i) into v_after from public.invoices i where id=p_invoice_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.invoice.post','invoices',p_invoice_id::text,v_before,v_after);
  return v_journal;
end;
$$;

create or replace function private.create_accounting_bill_draft(
  p_tenant_id uuid, p_org_id uuid, p_vendor_id uuid, p_bill_number text,
  p_bill_date date, p_due_date date, p_currency text, p_memo text
) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_id uuid; v_after jsonb; v_currency text;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.write');
  v_currency:=private.require_base_currency(p_tenant_id,p_org_id,p_currency);
  if not exists(select 1 from public.vendors where id=p_vendor_id and tenant_id=p_tenant_id and org_id=p_org_id and status='active') then raise exception 'Active vendor not found in scope'; end if;
  insert into public.bills(tenant_id,org_id,vendor_id,bill_number,bill_date,due_date,currency,memo,created_by)
  values(p_tenant_id,p_org_id,p_vendor_id,btrim(p_bill_number),p_bill_date,p_due_date,v_currency,nullif(btrim(coalesce(p_memo,'')),''),auth.uid()) returning id into v_id;
  select to_jsonb(b) into v_after from public.bills b where id=v_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.bill.create_draft','bills',v_id::text,null,v_after);
  return v_id;
end;
$$;

create or replace function private.replace_accounting_bill_lines(
  p_tenant_id uuid, p_org_id uuid, p_bill_id uuid, p_lines jsonb
) returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_status text; v_row jsonb; v_line_no integer:=0; v_account uuid; v_before jsonb; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.write');
  select status into v_status from public.bills where id=p_bill_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_status is null then raise exception 'Bill not found in scope'; end if;
  if v_status <> 'draft' then raise exception 'Only draft bills can change lines'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines)<1 then raise exception 'At least one bill line is required'; end if;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.line_number),'[]'::jsonb) into v_before from public.bill_lines l where bill_id=p_bill_id;
  delete from public.bill_lines where bill_id=p_bill_id and tenant_id=p_tenant_id and org_id=p_org_id;
  for v_row in select value from jsonb_array_elements(p_lines) loop
    v_line_no:=v_line_no+1;
    v_account:=(v_row->>'expense_account_id')::uuid;
    if not exists(select 1 from public.chart_of_accounts where id=v_account and tenant_id=p_tenant_id and org_id=p_org_id and active and account_type='expense') then raise exception 'Expense account % is not an active expense account in scope',v_account; end if;
    insert into public.bill_lines(tenant_id,org_id,bill_id,line_number,expense_account_id,description,quantity,unit_price,tax_amount)
    values(p_tenant_id,p_org_id,p_bill_id,v_line_no,v_account,btrim(v_row->>'description'),coalesce((v_row->>'quantity')::numeric,1),(v_row->>'unit_price')::numeric,coalesce((v_row->>'tax_amount')::numeric,0));
  end loop;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.line_number),'[]'::jsonb) into v_after from public.bill_lines l where bill_id=p_bill_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.bill.replace_lines','bills',p_bill_id::text,v_before,v_after);
end;
$$;

create or replace function private.approve_accounting_bill(p_tenant_id uuid,p_org_id uuid,p_bill_id uuid) returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_status text; v_approval text;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.approve');
  select to_jsonb(b),status,approval_state into v_before,v_status,v_approval from public.bills b where id=p_bill_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_before is null then raise exception 'Bill not found in scope'; end if;
  if v_status<>'draft' or v_approval<>'pending' then raise exception 'Only pending draft bills can be approved'; end if;
  update public.bills set approval_state='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=p_bill_id;
  select to_jsonb(b) into v_after from public.bills b where id=p_bill_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.bill.approve','bills',p_bill_id::text,v_before,v_after);
end;
$$;

create or replace function private.post_accounting_bill(p_tenant_id uuid,p_org_id uuid,p_bill_id uuid) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_bill public.bills%rowtype; v_ap uuid; v_count integer; v_total numeric(30,4); v_tax numeric(30,4);
  v_journal uuid; v_line_no integer:=0; v_line record; v_before jsonb; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.post');
  select * into v_bill from public.bills where id=p_bill_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_bill.id is null then raise exception 'Bill not found in scope'; end if;
  if v_bill.status<>'draft' then raise exception 'Only draft bills can be posted'; end if;
  if v_bill.approval_state<>'approved' then raise exception 'Bill must be approved before posting'; end if;
  perform private.require_base_currency(p_tenant_id,p_org_id,v_bill.currency);
  select default_ap_account_id into v_ap from public.accounting_settings where tenant_id=p_tenant_id and org_id=p_org_id;
  if v_ap is null then raise exception 'Default AP account is not configured'; end if;
  if not exists(select 1 from public.chart_of_accounts where id=v_ap and tenant_id=p_tenant_id and org_id=p_org_id and active and account_type='liability') then raise exception 'Default AP account must be an active liability account'; end if;
  select count(*),coalesce(sum(line_total),0),coalesce(sum(tax_amount),0) into v_count,v_total,v_tax from public.bill_lines where bill_id=p_bill_id and tenant_id=p_tenant_id and org_id=p_org_id;
  if v_count<1 or v_total<=0 then raise exception 'Bill must contain positive lines'; end if;
  if v_tax<>0 then raise exception 'Tax posting is not configured in Accounting v1; tax_amount must be zero'; end if;
  v_journal:=private.create_accounting_journal_draft(p_tenant_id,p_org_id,'AP-BILL-'||v_bill.bill_number,v_bill.bill_date,'Bill '||v_bill.bill_number,'bill',p_bill_id::text);
  for v_line in select * from public.bill_lines where bill_id=p_bill_id order by line_number loop
    v_line_no:=v_line_no+1;
    insert into public.journal_lines(tenant_id,org_id,journal_entry_id,line_number,account_id,description,debit,credit)
    values(p_tenant_id,p_org_id,v_journal,v_line_no,v_line.expense_account_id,v_line.description,v_line.line_total,0);
  end loop;
  v_line_no:=v_line_no+1;
  insert into public.journal_lines(tenant_id,org_id,journal_entry_id,line_number,account_id,description,debit,credit)
  values(p_tenant_id,p_org_id,v_journal,v_line_no,v_ap,'Accounts payable - '||v_bill.bill_number,0,v_total);
  perform private.post_accounting_journal(p_tenant_id,p_org_id,v_journal);
  v_before:=to_jsonb(v_bill);
  update public.bills set status='open',posted_journal_id=v_journal,posted_by=auth.uid(),posted_at=now(),updated_at=now() where id=p_bill_id;
  select to_jsonb(b) into v_after from public.bills b where id=p_bill_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.bill.post','bills',p_bill_id::text,v_before,v_after);
  return v_journal;
end;
$$;

create or replace function private.create_customer_payment_draft(
  p_tenant_id uuid,p_org_id uuid,p_customer_id uuid,p_invoice_id uuid,p_cash_account_id uuid,
  p_amount numeric,p_payment_date date,p_currency text,p_reference text
) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_id uuid; v_currency text; v_invoice public.invoices%rowtype; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.write');
  v_currency:=private.require_base_currency(p_tenant_id,p_org_id,p_currency);
  select * into v_invoice from public.invoices where id=p_invoice_id and tenant_id=p_tenant_id and org_id=p_org_id;
  if v_invoice.id is null or v_invoice.customer_id<>p_customer_id or v_invoice.status not in ('open','partially_paid') then raise exception 'Open invoice/customer relationship not found in scope'; end if;
  if v_currency<>v_invoice.currency then raise exception 'Payment currency must match invoice currency'; end if;
  if not exists(select 1 from public.chart_of_accounts where id=p_cash_account_id and tenant_id=p_tenant_id and org_id=p_org_id and active and account_type='asset') then raise exception 'Cash account must be an active asset account'; end if;
  insert into public.customer_payments(tenant_id,org_id,customer_id,invoice_id,cash_account_id,amount,payment_date,currency,reference,created_by)
  values(p_tenant_id,p_org_id,p_customer_id,p_invoice_id,p_cash_account_id,p_amount,p_payment_date,v_currency,nullif(btrim(coalesce(p_reference,'')),''),auth.uid()) returning id into v_id;
  select to_jsonb(p) into v_after from public.customer_payments p where id=v_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.customer_payment.create_draft','customer_payments',v_id::text,null,v_after);
  return v_id;
end;
$$;

create or replace function private.post_customer_payment(p_tenant_id uuid,p_org_id uuid,p_payment_id uuid) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_payment public.customer_payments%rowtype; v_invoice public.invoices%rowtype; v_ar uuid; v_total numeric(30,4); v_paid numeric(30,4); v_outstanding numeric(30,4);
  v_journal uuid; v_before jsonb; v_after jsonb; v_new_status text;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.post');
  select * into v_payment from public.customer_payments where id=p_payment_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_payment.id is null then raise exception 'Customer payment not found in scope'; end if;
  if v_payment.status<>'draft' then raise exception 'Only draft customer payments can be posted'; end if;
  select * into v_invoice from public.invoices where id=v_payment.invoice_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_invoice.status not in ('open','partially_paid') then raise exception 'Invoice is not open for payment'; end if;
  select default_ar_account_id into v_ar from public.accounting_settings where tenant_id=p_tenant_id and org_id=p_org_id;
  if v_ar is null then raise exception 'Default AR account is not configured'; end if;
  select coalesce(sum(line_total),0) into v_total from public.invoice_lines where invoice_id=v_invoice.id;
  select coalesce(sum(amount),0) into v_paid from public.customer_payments where invoice_id=v_invoice.id and status='posted';
  v_outstanding:=v_total-v_paid;
  if v_payment.amount>v_outstanding then raise exception 'Payment amount % exceeds outstanding balance %',v_payment.amount,v_outstanding; end if;
  v_journal:=private.create_accounting_journal_draft(p_tenant_id,p_org_id,'AR-PMT-'||p_payment_id::text,v_payment.payment_date,'Customer payment','customer_payment',p_payment_id::text);
  insert into public.journal_lines(tenant_id,org_id,journal_entry_id,line_number,account_id,description,debit,credit) values
    (p_tenant_id,p_org_id,v_journal,1,v_payment.cash_account_id,'Cash receipt',v_payment.amount,0),
    (p_tenant_id,p_org_id,v_journal,2,v_ar,'Reduce accounts receivable',0,v_payment.amount);
  perform private.post_accounting_journal(p_tenant_id,p_org_id,v_journal);
  v_before:=to_jsonb(v_payment);
  update public.customer_payments set status='posted',posted_journal_id=v_journal,posted_by=auth.uid(),posted_at=now(),updated_at=now() where id=p_payment_id;
  v_new_status:=case when v_payment.amount=v_outstanding then 'paid' else 'partially_paid' end;
  update public.invoices set status=v_new_status,updated_at=now() where id=v_invoice.id;
  select to_jsonb(p) into v_after from public.customer_payments p where id=p_payment_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.customer_payment.post','customer_payments',p_payment_id::text,v_before,v_after);
  return v_journal;
end;
$$;

create or replace function private.create_vendor_payment_draft(
  p_tenant_id uuid,p_org_id uuid,p_vendor_id uuid,p_bill_id uuid,p_cash_account_id uuid,
  p_amount numeric,p_payment_date date,p_currency text,p_reference text
) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_id uuid; v_currency text; v_bill public.bills%rowtype; v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.write');
  v_currency:=private.require_base_currency(p_tenant_id,p_org_id,p_currency);
  select * into v_bill from public.bills where id=p_bill_id and tenant_id=p_tenant_id and org_id=p_org_id;
  if v_bill.id is null or v_bill.vendor_id<>p_vendor_id or v_bill.status not in ('open','partially_paid') then raise exception 'Open bill/vendor relationship not found in scope'; end if;
  if v_currency<>v_bill.currency then raise exception 'Payment currency must match bill currency'; end if;
  if not exists(select 1 from public.chart_of_accounts where id=p_cash_account_id and tenant_id=p_tenant_id and org_id=p_org_id and active and account_type='asset') then raise exception 'Cash account must be an active asset account'; end if;
  insert into public.vendor_payments(tenant_id,org_id,vendor_id,bill_id,cash_account_id,amount,payment_date,currency,reference,created_by)
  values(p_tenant_id,p_org_id,p_vendor_id,p_bill_id,p_cash_account_id,p_amount,p_payment_date,v_currency,nullif(btrim(coalesce(p_reference,'')),''),auth.uid()) returning id into v_id;
  select to_jsonb(p) into v_after from public.vendor_payments p where id=v_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.vendor_payment.create_draft','vendor_payments',v_id::text,null,v_after);
  return v_id;
end;
$$;

create or replace function private.post_vendor_payment(p_tenant_id uuid,p_org_id uuid,p_payment_id uuid) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_payment public.vendor_payments%rowtype; v_bill public.bills%rowtype; v_ap uuid; v_total numeric(30,4); v_paid numeric(30,4); v_outstanding numeric(30,4);
  v_journal uuid; v_before jsonb; v_after jsonb; v_new_status text;
begin
  perform private.require_accounting_permission(p_tenant_id,p_org_id,'accounting.post');
  select * into v_payment from public.vendor_payments where id=p_payment_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_payment.id is null then raise exception 'Vendor payment not found in scope'; end if;
  if v_payment.status<>'draft' then raise exception 'Only draft vendor payments can be posted'; end if;
  select * into v_bill from public.bills where id=v_payment.bill_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_bill.status not in ('open','partially_paid') then raise exception 'Bill is not open for payment'; end if;
  select default_ap_account_id into v_ap from public.accounting_settings where tenant_id=p_tenant_id and org_id=p_org_id;
  if v_ap is null then raise exception 'Default AP account is not configured'; end if;
  select coalesce(sum(line_total),0) into v_total from public.bill_lines where bill_id=v_bill.id;
  select coalesce(sum(amount),0) into v_paid from public.vendor_payments where bill_id=v_bill.id and status='posted';
  v_outstanding:=v_total-v_paid;
  if v_payment.amount>v_outstanding then raise exception 'Payment amount % exceeds outstanding balance %',v_payment.amount,v_outstanding; end if;
  v_journal:=private.create_accounting_journal_draft(p_tenant_id,p_org_id,'AP-PMT-'||p_payment_id::text,v_payment.payment_date,'Vendor payment','vendor_payment',p_payment_id::text);
  insert into public.journal_lines(tenant_id,org_id,journal_entry_id,line_number,account_id,description,debit,credit) values
    (p_tenant_id,p_org_id,v_journal,1,v_ap,'Reduce accounts payable',v_payment.amount,0),
    (p_tenant_id,p_org_id,v_journal,2,v_payment.cash_account_id,'Cash disbursement',0,v_payment.amount);
  perform private.post_accounting_journal(p_tenant_id,p_org_id,v_journal);
  v_before:=to_jsonb(v_payment);
  update public.vendor_payments set status='posted',posted_journal_id=v_journal,posted_by=auth.uid(),posted_at=now(),updated_at=now() where id=p_payment_id;
  v_new_status:=case when v_payment.amount=v_outstanding then 'paid' else 'partially_paid' end;
  update public.bills set status=v_new_status,updated_at=now() where id=v_bill.id;
  select to_jsonb(p) into v_after from public.vendor_payments p where id=p_payment_id;
  perform private.accounting_audit(p_tenant_id,p_org_id,'accounting.vendor_payment.post','vendor_payments',p_payment_id::text,v_before,v_after);
  return v_journal;
end;
$$;

create or replace function public.create_accounting_customer(uuid,uuid,text,text,text,text) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.create_accounting_customer($1,$2,$3,$4,$5,$6); $$;
create or replace function public.create_accounting_vendor(uuid,uuid,text,text,text,text) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.create_accounting_vendor($1,$2,$3,$4,$5,$6); $$;
create or replace function public.create_accounting_invoice_draft(uuid,uuid,uuid,text,date,date,text,text) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.create_accounting_invoice_draft($1,$2,$3,$4,$5,$6,$7,$8); $$;
create or replace function public.replace_accounting_invoice_lines(uuid,uuid,uuid,jsonb) returns void language sql security invoker set search_path=public,private,pg_temp as $$ select private.replace_accounting_invoice_lines($1,$2,$3,$4); $$;
create or replace function public.post_accounting_invoice(uuid,uuid,uuid) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.post_accounting_invoice($1,$2,$3); $$;
create or replace function public.create_accounting_bill_draft(uuid,uuid,uuid,text,date,date,text,text) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.create_accounting_bill_draft($1,$2,$3,$4,$5,$6,$7,$8); $$;
create or replace function public.replace_accounting_bill_lines(uuid,uuid,uuid,jsonb) returns void language sql security invoker set search_path=public,private,pg_temp as $$ select private.replace_accounting_bill_lines($1,$2,$3,$4); $$;
create or replace function public.approve_accounting_bill(uuid,uuid,uuid) returns void language sql security invoker set search_path=public,private,pg_temp as $$ select private.approve_accounting_bill($1,$2,$3); $$;
create or replace function public.post_accounting_bill(uuid,uuid,uuid) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.post_accounting_bill($1,$2,$3); $$;
create or replace function public.create_customer_payment_draft(uuid,uuid,uuid,uuid,uuid,numeric,date,text,text) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.create_customer_payment_draft($1,$2,$3,$4,$5,$6,$7,$8,$9); $$;
create or replace function public.post_customer_payment(uuid,uuid,uuid) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.post_customer_payment($1,$2,$3); $$;
create or replace function public.create_vendor_payment_draft(uuid,uuid,uuid,uuid,uuid,numeric,date,text,text) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.create_vendor_payment_draft($1,$2,$3,$4,$5,$6,$7,$8,$9); $$;
create or replace function public.post_vendor_payment(uuid,uuid,uuid) returns uuid language sql security invoker set search_path=public,private,pg_temp as $$ select private.post_vendor_payment($1,$2,$3); $$;

revoke all on function private.require_base_currency(uuid,uuid,text) from public,anon,authenticated;
revoke all on function private.create_accounting_customer(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function private.create_accounting_vendor(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function private.create_accounting_invoice_draft(uuid,uuid,uuid,text,date,date,text,text) from public,anon,authenticated;
revoke all on function private.replace_accounting_invoice_lines(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function private.post_accounting_invoice(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private.create_accounting_bill_draft(uuid,uuid,uuid,text,date,date,text,text) from public,anon,authenticated;
revoke all on function private.replace_accounting_bill_lines(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function private.approve_accounting_bill(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private.post_accounting_bill(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private.create_customer_payment_draft(uuid,uuid,uuid,uuid,uuid,numeric,date,text,text) from public,anon,authenticated;
revoke all on function private.post_customer_payment(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private.create_vendor_payment_draft(uuid,uuid,uuid,uuid,uuid,numeric,date,text,text) from public,anon,authenticated;
revoke all on function private.post_vendor_payment(uuid,uuid,uuid) from public,anon,authenticated;

grant execute on function private.create_accounting_customer(uuid,uuid,text,text,text,text) to authenticated;
grant execute on function private.create_accounting_vendor(uuid,uuid,text,text,text,text) to authenticated;
grant execute on function private.create_accounting_invoice_draft(uuid,uuid,uuid,text,date,date,text,text) to authenticated;
grant execute on function private.replace_accounting_invoice_lines(uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function private.post_accounting_invoice(uuid,uuid,uuid) to authenticated;
grant execute on function private.create_accounting_bill_draft(uuid,uuid,uuid,text,date,date,text,text) to authenticated;
grant execute on function private.replace_accounting_bill_lines(uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function private.approve_accounting_bill(uuid,uuid,uuid) to authenticated;
grant execute on function private.post_accounting_bill(uuid,uuid,uuid) to authenticated;
grant execute on function private.create_customer_payment_draft(uuid,uuid,uuid,uuid,uuid,numeric,date,text,text) to authenticated;
grant execute on function private.post_customer_payment(uuid,uuid,uuid) to authenticated;
grant execute on function private.create_vendor_payment_draft(uuid,uuid,uuid,uuid,uuid,numeric,date,text,text) to authenticated;
grant execute on function private.post_vendor_payment(uuid,uuid,uuid) to authenticated;

revoke all on function public.create_accounting_customer(uuid,uuid,text,text,text,text) from public,anon;
revoke all on function public.create_accounting_vendor(uuid,uuid,text,text,text,text) from public,anon;
revoke all on function public.create_accounting_invoice_draft(uuid,uuid,uuid,text,date,date,text,text) from public,anon;
revoke all on function public.replace_accounting_invoice_lines(uuid,uuid,uuid,jsonb) from public,anon;
revoke all on function public.post_accounting_invoice(uuid,uuid,uuid) from public,anon;
revoke all on function public.create_accounting_bill_draft(uuid,uuid,uuid,text,date,date,text,text) from public,anon;
revoke all on function public.replace_accounting_bill_lines(uuid,uuid,uuid,jsonb) from public,anon;
revoke all on function public.approve_accounting_bill(uuid,uuid,uuid) from public,anon;
revoke all on function public.post_accounting_bill(uuid,uuid,uuid) from public,anon;
revoke all on function public.create_customer_payment_draft(uuid,uuid,uuid,uuid,uuid,numeric,date,text,text) from public,anon;
revoke all on function public.post_customer_payment(uuid,uuid,uuid) from public,anon;
revoke all on function public.create_vendor_payment_draft(uuid,uuid,uuid,uuid,uuid,numeric,date,text,text) from public,anon;
revoke all on function public.post_vendor_payment(uuid,uuid,uuid) from public,anon;

grant execute on function public.create_accounting_customer(uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.create_accounting_vendor(uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.create_accounting_invoice_draft(uuid,uuid,uuid,text,date,date,text,text) to authenticated;
grant execute on function public.replace_accounting_invoice_lines(uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function public.post_accounting_invoice(uuid,uuid,uuid) to authenticated;
grant execute on function public.create_accounting_bill_draft(uuid,uuid,uuid,text,date,date,text,text) to authenticated;
grant execute on function public.replace_accounting_bill_lines(uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function public.approve_accounting_bill(uuid,uuid,uuid) to authenticated;
grant execute on function public.post_accounting_bill(uuid,uuid,uuid) to authenticated;
grant execute on function public.create_customer_payment_draft(uuid,uuid,uuid,uuid,uuid,numeric,date,text,text) to authenticated;
grant execute on function public.post_customer_payment(uuid,uuid,uuid) to authenticated;
grant execute on function public.create_vendor_payment_draft(uuid,uuid,uuid,uuid,uuid,numeric,date,text,text) to authenticated;
grant execute on function public.post_vendor_payment(uuid,uuid,uuid) to authenticated;

commit;