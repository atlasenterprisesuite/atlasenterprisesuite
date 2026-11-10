insert into public.identity_permissions(code, description) values
  ('accounting.post','Post and reverse governed accounting journal entries'),
  ('accounting.close','Close and lock accounting periods after required gates pass'),
  ('accounting.admin','Administer governed accounting configuration')
on conflict (code) do update set description=excluded.description;

insert into public.identity_role_permissions(role, permission_code) values
  ('owner','accounting.post'),
  ('owner','accounting.close'),
  ('owner','accounting.admin'),
  ('admin','accounting.post'),
  ('admin','accounting.close'),
  ('admin','accounting.admin'),
  ('accountant','accounting.post')
on conflict do nothing;

drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs
for select to authenticated
using (public.has_identity_permission(org_id, 'audit.read'));

create table if not exists public.accounting_fixed_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.accounting_entities(id) on delete set null,
  asset_code text not null,
  name text not null,
  description text,
  acquisition_date date not null,
  cost numeric(18,2) not null check (cost >= 0),
  salvage_value numeric(18,2) not null default 0 check (salvage_value >= 0),
  useful_life_months integer not null check (useful_life_months > 0),
  depreciation_method text not null default 'straight_line' check (depreciation_method = 'straight_line'),
  status text not null default 'active' check (status in ('active','disposed','fully_depreciated')),
  accumulated_depreciation numeric(18,2) not null default 0 check (accumulated_depreciation >= 0),
  disposal_date date,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_fixed_assets_salvage_basis_check check (salvage_value <= cost),
  constraint accounting_fixed_assets_accumulated_basis_check check (accumulated_depreciation <= cost - salvage_value),
  constraint accounting_fixed_assets_code_normalized_check check (asset_code = upper(btrim(asset_code)) and btrim(asset_code) <> ''),
  constraint accounting_fixed_assets_name_check check (btrim(name) <> ''),
  unique(org_id, asset_code)
);

create index if not exists accounting_fixed_assets_org_id_idx on public.accounting_fixed_assets(org_id);
create index if not exists accounting_fixed_assets_entity_id_idx on public.accounting_fixed_assets(entity_id) where entity_id is not null;
create index if not exists accounting_fixed_assets_created_by_idx on public.accounting_fixed_assets(created_by) where created_by is not null;

alter table public.accounting_fixed_assets enable row level security;

drop policy if exists accounting_fixed_assets_read on public.accounting_fixed_assets;
create policy accounting_fixed_assets_read on public.accounting_fixed_assets
for select to authenticated using (public.is_org_member(org_id));

drop policy if exists accounting_fixed_assets_insert on public.accounting_fixed_assets;
create policy accounting_fixed_assets_insert on public.accounting_fixed_assets
for insert to authenticated with check (public.has_identity_permission(org_id,'accounting.write'));

drop policy if exists accounting_fixed_assets_update on public.accounting_fixed_assets;
create policy accounting_fixed_assets_update on public.accounting_fixed_assets
for update to authenticated
using (public.has_identity_permission(org_id,'accounting.write'))
with check (public.has_identity_permission(org_id,'accounting.write'));

drop policy if exists accounting_fixed_assets_delete on public.accounting_fixed_assets;
create policy accounting_fixed_assets_delete on public.accounting_fixed_assets
for delete to authenticated using (public.has_identity_permission(org_id,'accounting.write'));

drop trigger if exists accounting_fixed_assets_updated_at on public.accounting_fixed_assets;
create trigger accounting_fixed_assets_updated_at before update on public.accounting_fixed_assets
for each row execute function public.set_updated_at();

drop trigger if exists atlas_audit_accounting_fixed_assets on public.accounting_fixed_assets;
create trigger atlas_audit_accounting_fixed_assets after insert or update or delete on public.accounting_fixed_assets
for each row execute function public.audit_row_change();

create or replace function public.guard_accounting_journal_entry()
returns trigger
language plpgsql
security invoker
set search_path='public','pg_temp'
as $function$
declare
  effective_date date;
begin
  if tg_op='DELETE' then
    if old.status='posted' then raise exception 'Posted journal entries are immutable'; end if;
    return old;
  end if;

  if tg_op='UPDATE' and old.status='posted' then
    raise exception 'Posted journal entries are immutable';
  end if;

  if new.status='posted' and (tg_op='INSERT' or old.status is distinct from 'posted') then
    if not public.has_identity_permission(new.org_id,'accounting.post') then
      raise exception 'Accounting post permission required';
    end if;
    effective_date := coalesce(new.entry_date,current_date);
    if exists (
      select 1 from public.accounting_periods p
      where p.org_id=new.org_id
        and effective_date between p.period_start and p.period_end
        and p.status in ('closed','locked')
    ) then
      raise exception 'Accounting period is locked';
    end if;
    if new.id is not null and not public.validate_journal_entry(new.id) then
      raise exception 'Journal entry is not balanced';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_accounting_journal_entry on public.journal_entries;
create trigger guard_accounting_journal_entry
before insert or update or delete on public.journal_entries
for each row execute function public.guard_accounting_journal_entry();

create or replace function public.guard_accounting_journal_line()
returns trigger
language plpgsql
security invoker
set search_path='public','pg_temp'
as $function$
declare
  target_journal uuid;
  target_status text;
begin
  target_journal := case when tg_op='DELETE' then old.journal_entry_id else new.journal_entry_id end;
  if target_journal is null then return case when tg_op='DELETE' then old else new end; end if;

  select status into target_status from public.journal_entries where id=target_journal;
  if target_status='posted' then
    raise exception 'Posted journal lines are immutable';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$function$;

drop trigger if exists guard_accounting_journal_line on public.journal_lines;
create trigger guard_accounting_journal_line
before insert or update or delete on public.journal_lines
for each row execute function public.guard_accounting_journal_line();

create or replace function public.guard_accounting_period_close()
returns trigger
language plpgsql
security invoker
set search_path='public','pg_temp'
as $function$
begin
  if old.status in ('closed','locked') then
    raise exception 'Closed accounting period is immutable';
  end if;

  if new.status in ('closed','locked') and old.status not in ('closed','locked') then
    if not public.has_identity_permission(new.org_id,'accounting.close') then
      raise exception 'Accounting close permission required';
    end if;

    if exists (
      select 1 from public.journal_entries j
      where j.org_id=new.org_id
        and j.entry_date between new.period_start and new.period_end
        and j.status is distinct from 'posted'
    ) then
      raise exception 'All journals in the period must be posted before close';
    end if;

    if exists (
      select 1 from public.accounting_reconciliation_sessions r
      where r.org_id=new.org_id
        and r.period_start=new.period_start
        and r.period_end=new.period_end
        and r.status not in ('reconciled','locked')
    ) then
      raise exception 'All reconciliation sessions must be complete before close';
    end if;

    if exists (
      select 1 from public.accounting_bank_accounts b
      where b.org_id=new.org_id
        and b.connection_state='connected'
        and not exists (
          select 1 from public.accounting_reconciliation_sessions r
          where r.org_id=new.org_id
            and r.bank_account_id=b.id
            and r.period_start=new.period_start
            and r.period_end=new.period_end
            and r.status in ('reconciled','locked')
        )
    ) then
      raise exception 'Connected bank accounts require completed reconciliation before close';
    end if;

    if exists (
      select 1 from public.accounting_bills b
      where b.org_id=new.org_id
        and b.bill_date between new.period_start and new.period_end
        and b.approval_state in ('pending','on_hold')
    ) then
      raise exception 'Accounts Payable review is incomplete';
    end if;

    if exists (
      select 1 from public.invoices i
      where i.org_id=new.org_id
        and i.issue_date between new.period_start and new.period_end
        and coalesce(i.status,'draft')='draft'
    ) then
      raise exception 'Accounts Receivable review is incomplete';
    end if;

    if exists (
      select 1 from public.accounting_close_tasks t
      where t.org_id=new.org_id
        and t.period_id=new.id
        and t.status not in ('complete','waived')
    ) then
      raise exception 'Period close tasks remain incomplete';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_accounting_period_close on public.accounting_periods;
create trigger guard_accounting_period_close
before update on public.accounting_periods
for each row execute function public.guard_accounting_period_close();

create or replace function public.audit_accounting_period_close()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
begin
  if old.status not in ('closed','locked') and new.status in ('closed','locked') then
    insert into public.audit_logs(org_id,user_id,action,table_name,record_id,old_data,new_data)
    values(
      new.org_id,
      auth.uid(),
      'period.close',
      'accounting_periods',
      new.id::text,
      public.redact_atlas_audit_jsonb(to_jsonb(old)),
      public.redact_atlas_audit_jsonb(to_jsonb(new))
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists audit_accounting_period_close on public.accounting_periods;
create trigger audit_accounting_period_close
after update on public.accounting_periods
for each row execute function public.audit_accounting_period_close();

create or replace function public.guard_accounting_settings()
returns trigger
language plpgsql
security invoker
set search_path='public','pg_temp'
as $function$
declare
  old_accounting jsonb;
  new_accounting jsonb;
  fiscal_start text;
  currency_code text;
  basis text;
  ar_uuid uuid;
  ap_uuid uuid;
begin
  old_accounting := case when tg_op='INSERT' then null else old.settings->'accounting' end;
  new_accounting := new.settings->'accounting';

  if old_accounting is distinct from new_accounting then
    if not public.has_identity_permission(new.org_id,'accounting.admin') then
      raise exception 'Accounting admin permission required';
    end if;

    if new_accounting is not null then
      if jsonb_typeof(new_accounting) <> 'object' then raise exception 'Accounting settings must be an object'; end if;
      fiscal_start := new_accounting->>'fiscal_year_start';
      currency_code := new_accounting->>'base_currency';
      basis := new_accounting->>'accounting_basis';

      if fiscal_start is null or fiscal_start !~ '^\d{2}-\d{2}$'
         or to_char(to_date('2000-' || fiscal_start,'YYYY-MM-DD'),'MM-DD') <> fiscal_start then
        raise exception 'Fiscal year start is invalid';
      end if;
      if currency_code is null or currency_code !~ '^[A-Z]{3}$' then
        raise exception 'Base currency must be a three-letter uppercase currency code';
      end if;
      if basis is distinct from 'accrual' then
        raise exception 'Only accrual accounting is operationally supported';
      end if;

      if nullif(new_accounting->>'default_ar_account_id','') is not null then
        ar_uuid := (new_accounting->>'default_ar_account_id')::uuid;
        if not exists (
          select 1 from public.chart_of_accounts a
          where a.id=ar_uuid and a.org_id=new.org_id and a.account_type='asset' and a.active
        ) then raise exception 'Default AR account must be an active asset account in the organization'; end if;
      end if;

      if nullif(new_accounting->>'default_ap_account_id','') is not null then
        ap_uuid := (new_accounting->>'default_ap_account_id')::uuid;
        if not exists (
          select 1 from public.chart_of_accounts a
          where a.id=ap_uuid and a.org_id=new.org_id and a.account_type='liability' and a.active
        ) then raise exception 'Default AP account must be an active liability account in the organization'; end if;
      end if;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_accounting_settings on public.organization_settings;
create trigger guard_accounting_settings
before insert or update on public.organization_settings
for each row execute function public.guard_accounting_settings();

create or replace function public.audit_accounting_settings_change()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  old_accounting jsonb;
  new_accounting jsonb;
begin
  old_accounting := case when tg_op='INSERT' then null else old.settings->'accounting' end;
  new_accounting := new.settings->'accounting';
  if old_accounting is distinct from new_accounting then
    insert into public.audit_logs(org_id,user_id,action,table_name,record_id,old_data,new_data)
    values(
      new.org_id,
      auth.uid(),
      'accounting.settings.update',
      'organization_settings',
      new.org_id::text,
      public.redact_atlas_audit_jsonb(jsonb_build_object('accounting',old_accounting)),
      public.redact_atlas_audit_jsonb(jsonb_build_object('accounting',new_accounting))
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists audit_accounting_settings_change on public.organization_settings;
create trigger audit_accounting_settings_change
after insert or update on public.organization_settings
for each row execute function public.audit_accounting_settings_change();

create or replace function public.create_accounting_fixed_asset(
  organization_uuid uuid,
  asset_code text,
  asset_name text,
  acquired_on date,
  asset_cost numeric,
  salvage_amount numeric,
  useful_life_months integer
)
returns uuid
language plpgsql
security invoker
set search_path='public','pg_temp'
as $function$
declare asset_uuid uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if organization_uuid is null then raise exception 'Organization is required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.write') then raise exception 'Accounting write permission required'; end if;
  if nullif(btrim(coalesce(asset_code,'')),'') is null then raise exception 'Asset code is required'; end if;
  if nullif(btrim(coalesce(asset_name,'')),'') is null then raise exception 'Asset name is required'; end if;
  if acquired_on is null then raise exception 'Acquisition date is required'; end if;
  if asset_cost is null or asset_cost < 0 then raise exception 'Asset cost must be nonnegative'; end if;
  if salvage_amount is null or salvage_amount < 0 or salvage_amount > asset_cost then raise exception 'Salvage value must be between zero and cost'; end if;
  if useful_life_months is null or useful_life_months <= 0 then raise exception 'Useful life months must be positive'; end if;

  insert into public.accounting_fixed_assets(
    org_id,asset_code,name,acquisition_date,cost,salvage_value,useful_life_months,depreciation_method,status,created_by
  ) values (
    organization_uuid,upper(btrim(asset_code)),btrim(asset_name),acquired_on,asset_cost,salvage_amount,useful_life_months,'straight_line','active',auth.uid()
  ) returning id into asset_uuid;
  return asset_uuid;
exception when unique_violation then
  raise exception 'Asset code already exists in this organization';
end;
$function$;

create or replace function public.close_accounting_period(
  organization_uuid uuid,
  period_uuid uuid
)
returns uuid
language plpgsql
security invoker
set search_path='public','pg_temp'
as $function$
declare target_org uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if organization_uuid is null or period_uuid is null then raise exception 'Organization and period are required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.close') then raise exception 'Accounting close permission required'; end if;

  select org_id into target_org from public.accounting_periods where id=period_uuid for update;
  if target_org is null then raise exception 'Accounting period not found'; end if;
  if target_org<>organization_uuid then raise exception 'Accounting period organization mismatch'; end if;

  update public.accounting_periods
     set status='locked',close_readiness=100,closed_by=auth.uid(),closed_at=now()
   where id=period_uuid and org_id=organization_uuid;
  return period_uuid;
end;
$function$;

create or replace function public.set_accounting_settings(
  organization_uuid uuid,
  fiscal_year_start_value text,
  base_currency_value text,
  accounting_basis_value text,
  default_ar_account_uuid uuid,
  default_ap_account_uuid uuid
)
returns uuid
language plpgsql
security invoker
set search_path='public','pg_temp'
as $function$
declare accounting_json jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if organization_uuid is null then raise exception 'Organization is required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.admin') then raise exception 'Accounting admin permission required'; end if;

  accounting_json := jsonb_build_object(
    'fiscal_year_start',fiscal_year_start_value,
    'base_currency',upper(btrim(base_currency_value)),
    'accounting_basis',accounting_basis_value,
    'default_ar_account_id',default_ar_account_uuid,
    'default_ap_account_id',default_ap_account_uuid
  );

  insert into public.organization_settings(org_id,settings)
  values(organization_uuid,jsonb_build_object('accounting',accounting_json))
  on conflict(org_id) do update
    set settings=coalesce(public.organization_settings.settings,'{}'::jsonb) || jsonb_build_object('accounting',accounting_json);
  return organization_uuid;
end;
$function$;

create or replace function public.create_balanced_journal_entry(
  organization_uuid uuid,
  entry_code text,
  entry_on date,
  entry_memo text,
  debit_account_uuid uuid,
  credit_account_uuid uuid,
  entry_amount numeric
)
returns uuid
language plpgsql
security invoker
set search_path='public','pg_temp'
as $function$
declare
  journal_uuid uuid;
  valid_accounts integer;
  effective_date date := coalesce(entry_on,current_date);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.post') then raise exception 'Accounting post permission required'; end if;
  if entry_amount is null or entry_amount <= 0 then raise exception 'Entry amount must be greater than zero'; end if;
  if debit_account_uuid=credit_account_uuid then raise exception 'Debit and credit accounts must differ'; end if;
  if exists (
    select 1 from public.accounting_periods p
    where p.org_id=organization_uuid and effective_date between p.period_start and p.period_end and p.status in ('closed','locked')
  ) then raise exception 'Accounting period is locked'; end if;

  select count(*) into valid_accounts from public.chart_of_accounts
  where org_id=organization_uuid and id in (debit_account_uuid,credit_account_uuid) and active;
  if valid_accounts<>2 then raise exception 'Both accounts must be active and belong to the organization'; end if;

  insert into public.journal_entries(org_id,entry_number,entry_date,memo,status,created_by)
  values(organization_uuid,entry_code,effective_date,entry_memo,'draft',auth.uid()) returning id into journal_uuid;
  insert into public.journal_lines(org_id,journal_entry_id,account_id,debit,credit) values
    (organization_uuid,journal_uuid,debit_account_uuid,entry_amount,0),
    (organization_uuid,journal_uuid,credit_account_uuid,0,entry_amount);
  if not public.validate_journal_entry(journal_uuid) then raise exception 'Journal entry is not balanced'; end if;
  update public.journal_entries set status='posted' where id=journal_uuid;
  return journal_uuid;
end;
$function$;

create or replace function public.reverse_posted_journal_entry(
  organization_uuid uuid,
  journal_uuid uuid,
  reversal_code text,
  reversal_on date,
  reversal_reason text
)
returns uuid
language plpgsql
security invoker
set search_path='public','pg_temp'
as $function$
declare
  reversal_uuid uuid;
  original_entry_number text;
  original_status text;
  inserted_lines integer;
  effective_date date := coalesce(reversal_on,current_date);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.post') then raise exception 'Accounting post permission required'; end if;
  if nullif(btrim(coalesce(reversal_code,'')),'') is null then raise exception 'Reversal entry number is required'; end if;
  if nullif(btrim(coalesce(reversal_reason,'')),'') is null then raise exception 'Reversal reason is required'; end if;
  if exists (
    select 1 from public.accounting_periods p
    where p.org_id=organization_uuid and effective_date between p.period_start and p.period_end and p.status in ('closed','locked')
  ) then raise exception 'Accounting period is locked'; end if;

  select entry_number,status into original_entry_number,original_status
  from public.journal_entries where id=journal_uuid and org_id=organization_uuid for update;
  if not found then raise exception 'Journal entry not found in active organization'; end if;
  if original_status is distinct from 'posted' then raise exception 'Only posted journal entries can be reversed'; end if;
  if not public.validate_journal_entry(journal_uuid) then raise exception 'Original journal entry is not balanced'; end if;
  if exists(select 1 from public.journal_entries where org_id=organization_uuid and reverses_journal_entry_id=journal_uuid)
    then raise exception 'Journal entry has already been reversed'; end if;

  insert into public.journal_entries(org_id,entry_number,entry_date,memo,status,created_by,reverses_journal_entry_id)
  values(organization_uuid,reversal_code,effective_date,'Reversal of '||original_entry_number||': '||btrim(reversal_reason),'draft',auth.uid(),journal_uuid)
  returning id into reversal_uuid;
  insert into public.journal_lines(org_id,journal_entry_id,account_id,debit,credit)
  select organization_uuid,reversal_uuid,account_id,coalesce(credit,0),coalesce(debit,0)
  from public.journal_lines where journal_entry_id=journal_uuid and org_id=organization_uuid;
  get diagnostics inserted_lines=row_count;
  if inserted_lines<2 then raise exception 'Original journal entry does not contain enough lines to reverse'; end if;
  if not public.validate_journal_entry(reversal_uuid) then raise exception 'Reversal journal entry is not balanced'; end if;
  update public.journal_entries set status='posted' where id=reversal_uuid;
  return reversal_uuid;
end;
$function$;

revoke all on function public.create_accounting_fixed_asset(uuid,text,text,date,numeric,numeric,integer) from public;
revoke all on function public.create_accounting_fixed_asset(uuid,text,text,date,numeric,numeric,integer) from anon;
grant execute on function public.create_accounting_fixed_asset(uuid,text,text,date,numeric,numeric,integer) to authenticated;
revoke all on function public.close_accounting_period(uuid,uuid) from public;
revoke all on function public.close_accounting_period(uuid,uuid) from anon;
grant execute on function public.close_accounting_period(uuid,uuid) to authenticated;
revoke all on function public.set_accounting_settings(uuid,text,text,text,uuid,uuid) from public;
revoke all on function public.set_accounting_settings(uuid,text,text,text,uuid,uuid) from anon;
grant execute on function public.set_accounting_settings(uuid,text,text,text,uuid,uuid) to authenticated;
revoke all on function public.create_balanced_journal_entry(uuid,text,date,text,uuid,uuid,numeric) from public;
revoke all on function public.create_balanced_journal_entry(uuid,text,date,text,uuid,uuid,numeric) from anon;
grant execute on function public.create_balanced_journal_entry(uuid,text,date,text,uuid,uuid,numeric) to authenticated;
revoke all on function public.reverse_posted_journal_entry(uuid,uuid,text,date,text) from public;
revoke all on function public.reverse_posted_journal_entry(uuid,uuid,text,date,text) from anon;
grant execute on function public.reverse_posted_journal_entry(uuid,uuid,text,date,text) to authenticated;
