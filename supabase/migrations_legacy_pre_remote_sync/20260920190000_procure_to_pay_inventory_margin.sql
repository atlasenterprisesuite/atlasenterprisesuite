-- ATLAS Procure-to-Pay + Inventory Costing + Margin + COGS
-- Canonical flow: PO -> Receipt/Packing Slip -> 3-way match -> AP -> Margin pricing -> AR issue -> Inventory issue + GL.

alter table public.inventory_items
  add column if not exists average_unit_cost numeric not null default 0,
  add column if not exists last_unit_cost numeric not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inventory_items_average_unit_cost_check'
  ) then
    alter table public.inventory_items
      add constraint inventory_items_average_unit_cost_check check (average_unit_cost >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'inventory_items_last_unit_cost_check'
  ) then
    alter table public.inventory_items
      add constraint inventory_items_last_unit_cost_check check (last_unit_cost >= 0);
  end if;
end $$;

alter table public.products
  add column if not exists inventory_item_id uuid references public.inventory_items(id) on delete set null,
  add column if not exists target_margin_pct numeric;

create unique index if not exists products_inventory_item_unique
  on public.products (inventory_item_id)
  where inventory_item_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_target_margin_pct_check'
  ) then
    alter table public.products
      add constraint products_target_margin_pct_check
      check (target_margin_pct is null or (target_margin_pct >= 0 and target_margin_pct < 100));
  end if;
end $$;

create table if not exists public.inventory_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  packing_slip_number text not null,
  packing_slip_document_id uuid references public.documents(id) on delete set null,
  received_at timestamptz not null default now(),
  status text not null default 'posted',
  notes text,
  received_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (org_id, purchase_order_id, packing_slip_number),
  constraint inventory_receipts_status_check check (status in ('posted','void'))
);

create table if not exists public.inventory_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  receipt_id uuid not null references public.inventory_receipts(id) on delete cascade,
  purchase_order_line_id uuid not null references public.purchase_order_lines(id) on delete restrict,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric not null,
  unit_cost numeric not null,
  created_at timestamptz not null default now(),
  constraint inventory_receipt_lines_quantity_check check (quantity > 0),
  constraint inventory_receipt_lines_unit_cost_check check (unit_cost >= 0)
);

create index if not exists inventory_receipts_po_idx
  on public.inventory_receipts (org_id, purchase_order_id, received_at desc);
create index if not exists inventory_receipt_lines_receipt_idx
  on public.inventory_receipt_lines (org_id, receipt_id);
create index if not exists inventory_receipt_lines_po_line_idx
  on public.inventory_receipt_lines (org_id, purchase_order_line_id);

alter table public.accounting_bills
  add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete restrict,
  add column if not exists inventory_receipt_id uuid references public.inventory_receipts(id) on delete restrict,
  add column if not exists purchasing_vendor_id uuid references public.purchasing_vendors(id) on delete restrict;

create table if not exists public.accounting_bill_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  bill_id uuid not null references public.accounting_bills(id) on delete cascade,
  purchase_order_line_id uuid not null references public.purchase_order_lines(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  description text not null,
  quantity numeric not null,
  unit_cost numeric not null,
  tax_amount numeric not null default 0,
  line_total numeric not null,
  created_at timestamptz not null default now(),
  constraint accounting_bill_lines_quantity_check check (quantity > 0),
  constraint accounting_bill_lines_unit_cost_check check (unit_cost >= 0),
  constraint accounting_bill_lines_tax_amount_check check (tax_amount >= 0),
  constraint accounting_bill_lines_total_check check (line_total >= 0)
);

create index if not exists accounting_bill_lines_bill_idx
  on public.accounting_bill_lines (org_id, bill_id);
create index if not exists accounting_bill_lines_po_line_idx
  on public.accounting_bill_lines (org_id, purchase_order_line_id);

create table if not exists public.ap_three_way_matches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  bill_id uuid not null unique references public.accounting_bills(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  receipt_id uuid not null references public.inventory_receipts(id) on delete restrict,
  status text not null,
  quantity_variance numeric not null default 0,
  amount_variance numeric not null default 0,
  tolerance_pct numeric not null default 0,
  matched_by uuid default auth.uid(),
  matched_at timestamptz not null default now(),
  notes text,
  constraint ap_three_way_matches_status_check check (status in ('matched','exception')),
  constraint ap_three_way_matches_tolerance_check check (tolerance_pct >= 0 and tolerance_pct < 100)
);

create index if not exists ap_three_way_matches_org_po_idx
  on public.ap_three_way_matches (org_id, purchase_order_id, matched_at desc);

alter table public.invoices
  add column if not exists inventory_posted_at timestamptz,
  add column if not exists cogs_amount numeric,
  add column if not exists gross_profit numeric,
  add column if not exists gross_margin_pct numeric;

create table if not exists public.inventory_invoice_costing (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null unique references public.invoices(id) on delete cascade,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  net_sales numeric not null,
  tax_amount numeric not null default 0,
  cogs_amount numeric not null,
  gross_profit numeric not null,
  gross_margin_pct numeric,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  posted_by uuid default auth.uid(),
  posted_at timestamptz not null default now(),
  constraint inventory_invoice_costing_nonnegative_sales check (net_sales >= 0),
  constraint inventory_invoice_costing_nonnegative_tax check (tax_amount >= 0),
  constraint inventory_invoice_costing_nonnegative_cogs check (cogs_amount >= 0)
);

alter table public.inventory_receipts enable row level security;
alter table public.inventory_receipt_lines enable row level security;
alter table public.accounting_bill_lines enable row level security;
alter table public.ap_three_way_matches enable row level security;
alter table public.inventory_invoice_costing enable row level security;

drop policy if exists inventory_receipts_read on public.inventory_receipts;
create policy inventory_receipts_read on public.inventory_receipts
  for select to authenticated using (public.is_org_member(org_id));

drop policy if exists inventory_receipts_insert on public.inventory_receipts;
create policy inventory_receipts_insert on public.inventory_receipts
  for insert to authenticated with check (
    public.can_write_inventory_data(org_id) and public.can_write_purchasing_data(org_id)
  );

drop policy if exists inventory_receipt_lines_read on public.inventory_receipt_lines;
create policy inventory_receipt_lines_read on public.inventory_receipt_lines
  for select to authenticated using (public.is_org_member(org_id));

drop policy if exists inventory_receipt_lines_insert on public.inventory_receipt_lines;
create policy inventory_receipt_lines_insert on public.inventory_receipt_lines
  for insert to authenticated with check (
    public.can_write_inventory_data(org_id) and public.can_write_purchasing_data(org_id)
  );

drop policy if exists accounting_bill_lines_read on public.accounting_bill_lines;
create policy accounting_bill_lines_read on public.accounting_bill_lines
  for select to authenticated using (public.is_org_member(org_id));

drop policy if exists accounting_bill_lines_write on public.accounting_bill_lines;
create policy accounting_bill_lines_write on public.accounting_bill_lines
  for all to authenticated
  using (public.can_write_accounting_data(org_id))
  with check (public.can_write_accounting_data(org_id));

drop policy if exists ap_three_way_matches_read on public.ap_three_way_matches;
create policy ap_three_way_matches_read on public.ap_three_way_matches
  for select to authenticated using (public.is_org_member(org_id));

drop policy if exists inventory_invoice_costing_read on public.inventory_invoice_costing;
create policy inventory_invoice_costing_read on public.inventory_invoice_costing
  for select to authenticated using (public.is_org_member(org_id));

revoke insert, update, delete on public.inventory_receipts from authenticated;
revoke insert, update, delete on public.inventory_receipt_lines from authenticated;
revoke insert, update, delete on public.accounting_bill_lines from authenticated;
grant select on public.inventory_receipts to authenticated;
grant select on public.inventory_receipt_lines to authenticated;
grant select on public.accounting_bill_lines to authenticated;
grant select on public.ap_three_way_matches to authenticated;
grant select on public.inventory_invoice_costing to authenticated;

create or replace function public.atlas_ensure_inventory_accounts(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'organization_access_denied';
  end if;

  insert into public.chart_of_accounts (org_id, account_number, name, account_type, active)
  values
    (p_org_id, '1100', 'Accounts Receivable', 'asset', true),
    (p_org_id, '1200', 'Inventory', 'asset', true),
    (p_org_id, '2000', 'Accounts Payable', 'liability', true),
    (p_org_id, '2100', 'Sales Tax Payable', 'liability', true),
    (p_org_id, '4000', 'Revenue', 'revenue', true),
    (p_org_id, '5100', 'Cost of Goods Sold', 'expense', true)
  on conflict (org_id, account_number) do nothing;
end;
$$;

revoke all on function public.atlas_ensure_inventory_accounts(uuid) from public, anon, authenticated;

create or replace function public.receive_purchase_order_v1(
  p_org_id uuid,
  p_purchase_order_id uuid,
  p_location_id uuid,
  p_packing_slip_number text,
  p_lines jsonb,
  p_packing_slip_document_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt_id uuid := gen_random_uuid();
  v_po public.purchase_orders%rowtype;
  v_line jsonb;
  v_po_line public.purchase_order_lines%rowtype;
  v_qty numeric;
  v_remaining numeric;
  v_old_on_hand numeric;
  v_old_avg numeric;
  v_new_avg numeric;
  v_all_received boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not (public.can_write_inventory_data(p_org_id) and public.can_write_purchasing_data(p_org_id)) then
    raise exception 'receiving_permission_denied';
  end if;
  if coalesce(trim(p_packing_slip_number),'') = '' then raise exception 'packing_slip_number_required'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'receipt_lines_required';
  end if;

  select * into v_po
  from public.purchase_orders
  where id = p_purchase_order_id and org_id = p_org_id
  for update;

  if not found then raise exception 'purchase_order_not_found'; end if;
  if v_po.status not in ('approved','partially_received') then
    raise exception 'purchase_order_not_receivable';
  end if;

  perform 1 from public.inventory_locations
  where id = p_location_id and org_id = p_org_id and status = 'active';
  if not found then raise exception 'inventory_location_not_found'; end if;

  insert into public.inventory_receipts (
    id, org_id, purchase_order_id, location_id, packing_slip_number,
    packing_slip_document_id, notes, received_by
  ) values (
    v_receipt_id, p_org_id, p_purchase_order_id, p_location_id, trim(p_packing_slip_number),
    p_packing_slip_document_id, nullif(trim(coalesce(p_notes,'')),''), auth.uid()
  );

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_qty := nullif((v_line->>'quantity')::numeric, 0);
    if v_qty is null or v_qty <= 0 then raise exception 'receipt_quantity_must_be_positive'; end if;

    select * into v_po_line
    from public.purchase_order_lines
    where id = (v_line->>'purchase_order_line_id')::uuid
      and org_id = p_org_id
      and purchase_order_id = p_purchase_order_id
    for update;

    if not found then raise exception 'purchase_order_line_not_found'; end if;
    if v_po_line.item_id is null then raise exception 'purchase_order_line_inventory_item_required'; end if;

    v_remaining := v_po_line.quantity - v_po_line.received_quantity;
    if v_qty > v_remaining then raise exception 'receipt_quantity_exceeds_open_po_quantity'; end if;

    select
      coalesce(sum(quantity),0)
    into v_old_on_hand
    from public.inventory_movements
    where org_id = p_org_id and item_id = v_po_line.item_id;

    select average_unit_cost into v_old_avg
    from public.inventory_items
    where id = v_po_line.item_id and org_id = p_org_id
    for update;

    if not found then raise exception 'inventory_item_not_found'; end if;

    if (v_old_on_hand + v_qty) > 0 then
      v_new_avg := greatest(0, ((v_old_on_hand * coalesce(v_old_avg,0)) + (v_qty * v_po_line.unit_cost)) / (v_old_on_hand + v_qty));
    else
      v_new_avg := v_po_line.unit_cost;
    end if;

    insert into public.inventory_receipt_lines (
      org_id, receipt_id, purchase_order_line_id, item_id, quantity, unit_cost
    ) values (
      p_org_id, v_receipt_id, v_po_line.id, v_po_line.item_id, v_qty, v_po_line.unit_cost
    );

    insert into public.inventory_movements (
      org_id, item_id, location_id, movement_type, quantity,
      reference_type, reference_id, reference, notes, created_by
    ) values (
      p_org_id, v_po_line.item_id, p_location_id, 'receipt', v_qty,
      'purchase_receipt', v_receipt_id::text, v_po.po_number || ' / ' || trim(p_packing_slip_number),
      'PO receipt posted from packing slip', auth.uid()
    );

    update public.purchase_order_lines
      set received_quantity = received_quantity + v_qty,
          updated_at = now()
    where id = v_po_line.id;

    update public.inventory_items
      set average_unit_cost = v_new_avg,
          last_unit_cost = v_po_line.unit_cost,
          updated_at = now()
    where id = v_po_line.item_id and org_id = p_org_id;

    update public.products
      set unit_cost = v_new_avg,
          unit_price = case
            when target_margin_pct is not null and v_new_avg > 0
              then round(v_new_avg / (1 - target_margin_pct / 100), 2)
            else unit_price
          end,
          updated_at = now()
    where org_id = p_org_id and inventory_item_id = v_po_line.item_id;
  end loop;

  select bool_and(received_quantity >= quantity)
    into v_all_received
  from public.purchase_order_lines
  where org_id = p_org_id and purchase_order_id = p_purchase_order_id;

  update public.purchase_orders
    set status = case when coalesce(v_all_received,false) then 'received' else 'partially_received' end,
        updated_at = now()
  where id = p_purchase_order_id and org_id = p_org_id;

  return v_receipt_id;
end;
$$;

revoke all on function public.receive_purchase_order_v1(uuid,uuid,uuid,text,jsonb,uuid,text) from public, anon;
grant execute on function public.receive_purchase_order_v1(uuid,uuid,uuid,text,jsonb,uuid,text) to authenticated;

create or replace function public.register_matched_ap_bill_v1(
  p_org_id uuid,
  p_purchase_order_id uuid,
  p_receipt_id uuid,
  p_bill_number text,
  p_bill_date date,
  p_due_date date,
  p_lines jsonb,
  p_tolerance_pct numeric default 0.5,
  p_source_document_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_receipt public.inventory_receipts%rowtype;
  v_bill_id uuid := gen_random_uuid();
  v_match_id uuid := gen_random_uuid();
  v_line jsonb;
  v_po_line public.purchase_order_lines%rowtype;
  v_receipt_qty numeric;
  v_billed_qty numeric;
  v_invoice_qty numeric;
  v_invoice_unit_cost numeric;
  v_tax numeric;
  v_line_total numeric;
  v_total numeric := 0;
  v_amount_variance numeric := 0;
  v_quantity_variance numeric := 0;
  v_cost_variance_pct numeric;
  v_item_on_hand numeric;
  v_current_avg numeric;
  v_adjusted_avg numeric;
  v_inventory_account uuid;
  v_ap_account uuid;
  v_journal_id uuid := gen_random_uuid();
  v_journal_number text := 'JE-' || to_char(current_date,'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.can_write_accounting_data(p_org_id) then raise exception 'accounts_payable_permission_denied'; end if;
  if not public.has_identity_permission(p_org_id, 'accounting.post') then raise exception 'accounting_post_permission_required'; end if;
  if p_tolerance_pct < 0 or p_tolerance_pct >= 100 then raise exception 'invalid_match_tolerance'; end if;
  if coalesce(trim(p_bill_number),'') = '' then raise exception 'bill_number_required'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'bill_lines_required'; end if;

  select * into v_po from public.purchase_orders
  where id = p_purchase_order_id and org_id = p_org_id;
  if not found then raise exception 'purchase_order_not_found'; end if;

  select * into v_receipt from public.inventory_receipts
  where id = p_receipt_id and org_id = p_org_id and purchase_order_id = p_purchase_order_id and status = 'posted';
  if not found then raise exception 'posted_receipt_not_found'; end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_invoice_qty := (v_line->>'quantity')::numeric;
    v_invoice_unit_cost := (v_line->>'unit_cost')::numeric;
    v_tax := coalesce((v_line->>'tax_amount')::numeric,0);

    if v_invoice_qty <= 0 then raise exception 'invoice_quantity_must_be_positive'; end if;
    if v_invoice_unit_cost < 0 or v_tax < 0 then raise exception 'invoice_cost_invalid'; end if;

    select * into v_po_line
    from public.purchase_order_lines
    where id = (v_line->>'purchase_order_line_id')::uuid
      and org_id = p_org_id
      and purchase_order_id = p_purchase_order_id;
    if not found then raise exception 'purchase_order_line_not_found'; end if;
    if v_po_line.item_id is null then raise exception 'purchase_order_line_inventory_item_required'; end if;

    select coalesce(sum(quantity),0) into v_receipt_qty
    from public.inventory_receipt_lines
    where org_id = p_org_id and receipt_id = p_receipt_id and purchase_order_line_id = v_po_line.id;

    if v_invoice_qty <> v_receipt_qty then
      raise exception 'three_way_quantity_mismatch';
    end if;

    select coalesce(sum(abl.quantity),0) into v_billed_qty
    from public.accounting_bill_lines abl
    join public.accounting_bills ab on ab.id = abl.bill_id
    where abl.org_id = p_org_id
      and abl.purchase_order_line_id = v_po_line.id
      and ab.status <> 'void';

    if v_billed_qty + v_invoice_qty > v_po_line.received_quantity then
      raise exception 'invoice_quantity_exceeds_received_quantity';
    end if;

    if v_po_line.unit_cost = 0 then
      v_cost_variance_pct := case when v_invoice_unit_cost = 0 then 0 else 100 end;
    else
      v_cost_variance_pct := abs((v_invoice_unit_cost - v_po_line.unit_cost) / v_po_line.unit_cost) * 100;
    end if;

    if v_cost_variance_pct > p_tolerance_pct then
      raise exception 'three_way_cost_mismatch';
    end if;

    v_line_total := round((v_invoice_qty * v_invoice_unit_cost) + v_tax, 2);
    v_total := v_total + v_line_total;
    v_amount_variance := v_amount_variance + round((v_invoice_qty * (v_invoice_unit_cost - v_po_line.unit_cost)), 2);
    v_quantity_variance := v_quantity_variance + (v_invoice_qty - v_receipt_qty);
  end loop;

  insert into public.accounting_bills (
    id, org_id, purchasing_vendor_id, purchase_order_id, inventory_receipt_id,
    bill_number, bill_date, due_date, amount, balance_due,
    approval_state, match_state, status, source_document_id, created_by
  ) values (
    v_bill_id, p_org_id, v_po.vendor_id, p_purchase_order_id, p_receipt_id,
    trim(p_bill_number), coalesce(p_bill_date,current_date), p_due_date, v_total, v_total,
    'pending', 'three_way_matched', 'open', p_source_document_id, auth.uid()
  );

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_invoice_qty := (v_line->>'quantity')::numeric;
    v_invoice_unit_cost := (v_line->>'unit_cost')::numeric;
    v_tax := coalesce((v_line->>'tax_amount')::numeric,0);

    select * into v_po_line
    from public.purchase_order_lines
    where id = (v_line->>'purchase_order_line_id')::uuid
      and org_id = p_org_id
      and purchase_order_id = p_purchase_order_id;

    v_line_total := round((v_invoice_qty * v_invoice_unit_cost) + v_tax, 2);

    insert into public.accounting_bill_lines (
      org_id,bill_id,purchase_order_line_id,inventory_item_id,description,
      quantity,unit_cost,tax_amount,line_total
    ) values (
      p_org_id,v_bill_id,v_po_line.id,v_po_line.item_id,v_po_line.description,
      v_invoice_qty,v_invoice_unit_cost,v_tax,v_line_total
    );

    select coalesce(sum(quantity),0) into v_item_on_hand
    from public.inventory_movements
    where org_id = p_org_id and item_id = v_po_line.item_id;

    select average_unit_cost into v_current_avg
    from public.inventory_items
    where id = v_po_line.item_id and org_id = p_org_id
    for update;

    if v_item_on_hand > 0 then
      v_adjusted_avg := greatest(
        0,
        v_current_avg
          + (((v_invoice_unit_cost - v_po_line.unit_cost) * v_invoice_qty + v_tax) / v_item_on_hand)
      );
    else
      v_adjusted_avg := v_invoice_unit_cost + (v_tax / v_invoice_qty);
    end if;

    update public.inventory_items
      set average_unit_cost = v_adjusted_avg,
          last_unit_cost = v_invoice_unit_cost,
          updated_at = now()
    where id = v_po_line.item_id and org_id = p_org_id;

    update public.products
      set unit_cost = v_adjusted_avg,
          unit_price = case
            when target_margin_pct is not null and v_adjusted_avg > 0
              then round(v_adjusted_avg / (1 - target_margin_pct / 100), 2)
            else unit_price
          end,
          updated_at = now()
    where org_id = p_org_id and inventory_item_id = v_po_line.item_id;
  end loop;

  insert into public.ap_three_way_matches (
    id,org_id,bill_id,purchase_order_id,receipt_id,status,
    quantity_variance,amount_variance,tolerance_pct,matched_by
  ) values (
    v_match_id,p_org_id,v_bill_id,p_purchase_order_id,p_receipt_id,'matched',
    v_quantity_variance,v_amount_variance,p_tolerance_pct,auth.uid()
  );

  perform public.atlas_ensure_inventory_accounts(p_org_id);
  select id into v_inventory_account from public.chart_of_accounts where org_id=p_org_id and account_number='1200';
  select id into v_ap_account from public.chart_of_accounts where org_id=p_org_id and account_number='2000';

  insert into public.journal_entries (
    id,org_id,entry_number,entry_date,memo,status,created_by
  ) values (
    v_journal_id,p_org_id,v_journal_number,coalesce(p_bill_date,current_date),
    'Matched vendor bill ' || trim(p_bill_number) || ' for ' || v_po.po_number,
    'draft',auth.uid()
  );

  insert into public.journal_lines (org_id,journal_entry_id,account_id,debit,credit)
  values
    (p_org_id,v_journal_id,v_inventory_account,v_total,0),
    (p_org_id,v_journal_id,v_ap_account,0,v_total);

  update public.journal_entries
    set status = 'posted'
  where id = v_journal_id and org_id = p_org_id;

  return jsonb_build_object(
    'bill_id',v_bill_id,
    'match_id',v_match_id,
    'journal_entry_id',v_journal_id,
    'match_state','three_way_matched',
    'amount',v_total
  );
end;
$$;

revoke all on function public.register_matched_ap_bill_v1(uuid,uuid,uuid,text,date,date,jsonb,numeric,uuid) from public, anon;
grant execute on function public.register_matched_ap_bill_v1(uuid,uuid,uuid,text,date,date,jsonb,numeric,uuid) to authenticated;

create or replace function public.set_product_margin_v1(
  p_org_id uuid,
  p_product_id uuid,
  p_target_margin_pct numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item_id uuid;
  v_cost numeric;
  v_price numeric;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not (public.can_write_business_data(p_org_id) and public.can_write_accounting_data(p_org_id)) then
    raise exception 'pricing_permission_denied';
  end if;
  if p_target_margin_pct < 0 or p_target_margin_pct >= 100 then raise exception 'invalid_margin_percentage'; end if;

  select inventory_item_id into v_item_id
  from public.products
  where id = p_product_id and org_id = p_org_id
  for update;
  if not found then raise exception 'product_not_found'; end if;
  if v_item_id is null then raise exception 'product_inventory_link_required'; end if;

  if exists (
    select 1
    from public.inventory_receipt_lines irl
    join public.inventory_receipts ir
      on ir.id = irl.receipt_id
     and ir.org_id = p_org_id
    where irl.org_id = p_org_id
      and irl.item_id = v_item_id
      and ir.status = 'posted'
      and not exists (
        select 1
        from public.accounting_bills ab
        where ab.org_id = p_org_id
          and ab.inventory_receipt_id = ir.id
          and ab.match_state = 'three_way_matched'
          and ab.status <> 'void'
      )
  ) then
    raise exception 'unmatched_purchase_receipt_blocks_pricing';
  end if;

  select average_unit_cost into v_cost
  from public.inventory_items
  where id = v_item_id and org_id = p_org_id;

  if v_cost is null then raise exception 'inventory_cost_unavailable'; end if;
  v_price := case when v_cost = 0 then 0 else round(v_cost / (1 - p_target_margin_pct / 100), 2) end;

  update public.products
    set target_margin_pct = p_target_margin_pct,
        unit_cost = v_cost,
        unit_price = v_price,
        updated_at = now()
  where id = p_product_id and org_id = p_org_id;

  return jsonb_build_object(
    'product_id',p_product_id,
    'unit_cost',v_cost,
    'target_margin_pct',p_target_margin_pct,
    'unit_price',v_price,
    'gross_profit_per_unit',round(v_price-v_cost,2)
  );
end;
$$;

revoke all on function public.set_product_margin_v1(uuid,uuid,numeric) from public, anon;
grant execute on function public.set_product_margin_v1(uuid,uuid,numeric) to authenticated;

create or replace function public.guard_inventory_invoice_issue()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'draft' and new.status = 'open'
     and new.inventory_posted_at is null
     and exists (
       select 1
       from public.invoice_lines il
       join public.products p on p.id = il.product_id and p.org_id = new.org_id
       where il.invoice_id = new.id
         and il.org_id = new.org_id
         and p.inventory_item_id is not null
     )
  then
    raise exception 'inventory_invoice_requires_governed_issue';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_inventory_invoice_issue on public.invoices;
create trigger trg_guard_inventory_invoice_issue
before update on public.invoices
for each row execute function public.guard_inventory_invoice_issue();

create or replace function public.issue_inventory_invoice_v1(
  p_org_id uuid,
  p_invoice_id uuid,
  p_location_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_line record;
  v_item_id uuid;
  v_cost numeric;
  v_on_hand numeric;
  v_cogs numeric := 0;
  v_net_sales numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_gross_profit numeric := 0;
  v_margin numeric;
  v_ar_account uuid;
  v_inventory_account uuid;
  v_tax_account uuid;
  v_revenue_account uuid;
  v_cogs_account uuid;
  v_journal_id uuid := gen_random_uuid();
  v_journal_number text := 'JE-' || to_char(current_date,'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not (
    public.can_write_business_data(p_org_id)
    and public.can_write_inventory_data(p_org_id)
    and public.can_write_accounting_data(p_org_id)
  ) then
    raise exception 'inventory_invoice_permission_denied';
  end if;
  if not public.has_identity_permission(p_org_id, 'accounting.post') then
    raise exception 'accounting_post_permission_required';
  end if;

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id and org_id = p_org_id
  for update;

  if not found then raise exception 'invoice_not_found'; end if;
  if v_invoice.status <> 'draft' or coalesce(v_invoice.total,0) <= 0 then raise exception 'invoice_not_issuable'; end if;
  if v_invoice.inventory_posted_at is not null then raise exception 'inventory_invoice_already_posted'; end if;

  perform 1 from public.inventory_locations
  where id = p_location_id and org_id = p_org_id and status='active';
  if not found then raise exception 'inventory_location_not_found'; end if;

  if not exists (select 1 from public.invoice_lines where invoice_id=p_invoice_id and org_id=p_org_id) then
    raise exception 'invoice_lines_required';
  end if;

  for v_line in
    select il.*, p.inventory_item_id, p.name as product_name
    from public.invoice_lines il
    left join public.products p on p.id=il.product_id and p.org_id=il.org_id
    where il.invoice_id=p_invoice_id and il.org_id=p_org_id
    order by il.created_at,il.id
  loop
    v_net_sales := v_net_sales + round(coalesce(v_line.quantity,0) * coalesce(v_line.unit_price,0),2);
    v_tax := v_tax + round(coalesce(v_line.quantity,0) * coalesce(v_line.unit_price,0) * coalesce(v_line.tax_rate,0) / 100,2);

    if v_line.product_id is not null and v_line.inventory_item_id is not null then
      v_item_id := v_line.inventory_item_id;

      if exists (
        select 1
        from public.inventory_receipt_lines irl
        join public.inventory_receipts ir
          on ir.id = irl.receipt_id
         and ir.org_id = p_org_id
        where irl.org_id = p_org_id
          and irl.item_id = v_item_id
          and ir.status = 'posted'
          and not exists (
            select 1
            from public.accounting_bills ab
            where ab.org_id = p_org_id
              and ab.inventory_receipt_id = ir.id
              and ab.match_state = 'three_way_matched'
              and ab.status <> 'void'
          )
      ) then
        raise exception 'unmatched_purchase_receipt_blocks_sale';
      end if;

      select average_unit_cost into v_cost
      from public.inventory_items
      where id=v_item_id and org_id=p_org_id
      for update;

      select coalesce(sum(quantity),0) into v_on_hand
      from public.inventory_movements
      where org_id=p_org_id and item_id=v_item_id and location_id=p_location_id;

      if v_on_hand < coalesce(v_line.quantity,0) then
        raise exception 'insufficient_inventory_for_invoice';
      end if;

      insert into public.inventory_movements (
        org_id,item_id,location_id,movement_type,quantity,
        reference_type,reference_id,reference,notes,created_by
      ) values (
        p_org_id,v_item_id,p_location_id,'issue',-abs(v_line.quantity),
        'customer_invoice',p_invoice_id::text,v_invoice.invoice_number,
        'Inventory issued by governed customer invoice posting',auth.uid()
      );

      v_cogs := v_cogs + round(abs(v_line.quantity) * coalesce(v_cost,0),2);

      update public.products p
      set quantity = (
        select coalesce(sum(im.quantity),0)
        from public.inventory_movements im
        where im.org_id=p_org_id and im.item_id=v_item_id
      ),
      unit_cost = coalesce(v_cost,0),
      updated_at=now()
      where p.org_id=p_org_id and p.inventory_item_id=v_item_id;
    end if;
  end loop;

  v_total := v_net_sales + v_tax;
  v_gross_profit := v_net_sales - v_cogs;
  v_margin := case when v_net_sales > 0 then round((v_gross_profit / v_net_sales) * 100,4) else null end;

  perform public.atlas_ensure_inventory_accounts(p_org_id);
  select id into v_ar_account from public.chart_of_accounts where org_id=p_org_id and account_number='1100';
  select id into v_inventory_account from public.chart_of_accounts where org_id=p_org_id and account_number='1200';
  select id into v_tax_account from public.chart_of_accounts where org_id=p_org_id and account_number='2100';
  select id into v_revenue_account from public.chart_of_accounts where org_id=p_org_id and account_number='4000';
  select id into v_cogs_account from public.chart_of_accounts where org_id=p_org_id and account_number='5100';

  insert into public.journal_entries (
    id,org_id,entry_number,entry_date,memo,status,created_by
  ) values (
    v_journal_id,p_org_id,v_journal_number,coalesce(v_invoice.issue_date,current_date),
    'Customer invoice ' || v_invoice.invoice_number || ' with inventory costing',
    'draft',auth.uid()
  );

  insert into public.journal_lines (org_id,journal_entry_id,account_id,debit,credit)
  values (p_org_id,v_journal_id,v_ar_account,v_total,0);

  if v_net_sales > 0 then
    insert into public.journal_lines (org_id,journal_entry_id,account_id,debit,credit)
    values (p_org_id,v_journal_id,v_revenue_account,0,v_net_sales);
  end if;

  if v_tax > 0 then
    insert into public.journal_lines (org_id,journal_entry_id,account_id,debit,credit)
    values (p_org_id,v_journal_id,v_tax_account,0,v_tax);
  end if;

  if v_cogs > 0 then
    insert into public.journal_lines (org_id,journal_entry_id,account_id,debit,credit)
    values
      (p_org_id,v_journal_id,v_cogs_account,v_cogs,0),
      (p_org_id,v_journal_id,v_inventory_account,0,v_cogs);
  end if;

  update public.journal_entries
    set status = 'posted'
  where id = v_journal_id and org_id = p_org_id;

  update public.invoices
    set status='open',
        balance_due=v_total,
        total=v_total,
        inventory_posted_at=now(),
        cogs_amount=v_cogs,
        gross_profit=v_gross_profit,
        gross_margin_pct=v_margin,
        updated_at=now()
  where id=p_invoice_id and org_id=p_org_id;

  insert into public.inventory_invoice_costing (
    org_id,invoice_id,location_id,net_sales,tax_amount,cogs_amount,
    gross_profit,gross_margin_pct,journal_entry_id,posted_by
  ) values (
    p_org_id,p_invoice_id,p_location_id,v_net_sales,v_tax,v_cogs,
    v_gross_profit,v_margin,v_journal_id,auth.uid()
  );

  return jsonb_build_object(
    'invoice_id',p_invoice_id,
    'journal_entry_id',v_journal_id,
    'net_sales',v_net_sales,
    'tax_amount',v_tax,
    'cogs_amount',v_cogs,
    'gross_profit',v_gross_profit,
    'gross_margin_pct',v_margin,
    'status','open'
  );
end;
$$;

revoke all on function public.issue_inventory_invoice_v1(uuid,uuid,uuid) from public, anon;
grant execute on function public.issue_inventory_invoice_v1(uuid,uuid,uuid) to authenticated;
