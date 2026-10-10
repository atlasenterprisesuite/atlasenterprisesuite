create table if not exists public.accounting_fx_rates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.accounting_entities(id) on delete cascade,
  rate_date date not null,
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  quote_currency text not null check (quote_currency ~ '^[A-Z]{3}$'),
  rate numeric(20,10) not null check (rate > 0),
  source_type text not null default 'manual' check (source_type in ('manual','provider')),
  source_name text not null,
  source_reference text,
  evidence_state text not null default 'manual' check (evidence_state in ('manual','verified','unverified')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (base_currency <> quote_currency)
);

create index if not exists accounting_fx_rates_lookup_idx
  on public.accounting_fx_rates(org_id, entity_id, rate_date desc, base_currency, quote_currency);

alter table public.accounting_fx_rates enable row level security;

drop policy if exists accounting_fx_rates_read on public.accounting_fx_rates;
create policy accounting_fx_rates_read on public.accounting_fx_rates
  for select using (public.is_org_member(org_id));

drop policy if exists accounting_fx_rates_insert on public.accounting_fx_rates;
create policy accounting_fx_rates_insert on public.accounting_fx_rates
  for insert with check (public.can_write_accounting_data(org_id) and created_by=auth.uid());

drop policy if exists accounting_fx_rates_update on public.accounting_fx_rates;
create policy accounting_fx_rates_update on public.accounting_fx_rates
  for update using (public.has_identity_permission(org_id,'accounting.admin'))
  with check (public.has_identity_permission(org_id,'accounting.admin'));

drop policy if exists accounting_fx_rates_delete on public.accounting_fx_rates;
create policy accounting_fx_rates_delete on public.accounting_fx_rates
  for delete using (public.has_identity_permission(org_id,'accounting.admin'));

alter table public.journal_entries
  add column if not exists entity_id uuid references public.accounting_entities(id) on delete restrict,
  add column if not exists transaction_currency text,
  add column if not exists functional_currency text,
  add column if not exists exchange_rate numeric(20,10),
  add column if not exists fx_rate_id uuid references public.accounting_fx_rates(id) on delete restrict;

alter table public.journal_lines
  add column if not exists transaction_debit numeric(18,2),
  add column if not exists transaction_credit numeric(18,2);

create or replace function public.guard_accounting_fx_rate()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  new.base_currency := upper(btrim(new.base_currency));
  new.quote_currency := upper(btrim(new.quote_currency));
  new.source_name := btrim(new.source_name);

  if new.base_currency !~ '^[A-Z]{3}$' or new.quote_currency !~ '^[A-Z]{3}$' then
    raise exception 'Currency code must use three letters';
  end if;
  if new.base_currency = new.quote_currency then raise exception 'FX rate requires two different currencies'; end if;
  if new.rate is null or new.rate <= 0 then raise exception 'FX rate must be greater than zero'; end if;
  if nullif(new.source_name,'') is null then raise exception 'FX rate source is required'; end if;

  if new.entity_id is not null and not exists(
    select 1 from public.accounting_entities e where e.id=new.entity_id and e.org_id=new.org_id and e.active
  ) then raise exception 'FX rate entity must be active and belong to the organization'; end if;

  if tg_op='UPDATE' and old.evidence_state='verified' then
    raise exception 'Verified FX rates are immutable';
  end if;

  return new;
end;
$function$;

drop trigger if exists accounting_fx_rates_guard on public.accounting_fx_rates;
create trigger accounting_fx_rates_guard
before insert or update on public.accounting_fx_rates
for each row execute function public.guard_accounting_fx_rate();

drop trigger if exists accounting_fx_rates_audit on public.accounting_fx_rates;
create trigger accounting_fx_rates_audit
after insert or update or delete on public.accounting_fx_rates
for each row execute function public.audit_row_change();

create or replace function public.create_manual_accounting_fx_rate(
  organization_uuid uuid,
  entity_uuid uuid,
  rate_on date,
  base_currency_value text,
  quote_currency_value text,
  rate_value numeric,
  source_reference_value text
)
returns uuid
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare rate_uuid uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.write') then raise exception 'Accounting write permission required'; end if;
  if rate_on is null then raise exception 'FX rate date is required'; end if;
  if rate_value is null or rate_value <= 0 then raise exception 'FX rate must be greater than zero'; end if;

  insert into public.accounting_fx_rates(
    org_id,entity_id,rate_date,base_currency,quote_currency,rate,
    source_type,source_name,source_reference,evidence_state,created_by
  ) values (
    organization_uuid,entity_uuid,rate_on,upper(btrim(base_currency_value)),upper(btrim(quote_currency_value)),rate_value,
    'manual','Manual entry',nullif(btrim(source_reference_value),''),'manual',auth.uid()
  ) returning id into rate_uuid;

  return rate_uuid;
end;
$function$;

create or replace function public.create_multicurrency_journal_entry(
  organization_uuid uuid,
  entity_uuid uuid,
  entry_code text,
  entry_on date,
  entry_memo text,
  transaction_currency_value text,
  fx_rate_uuid uuid,
  debit_account_uuid uuid,
  credit_account_uuid uuid,
  transaction_amount numeric
)
returns uuid
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  journal_uuid uuid;
  effective_date date := coalesce(entry_on,current_date);
  tx_currency text := upper(btrim(transaction_currency_value));
  functional_currency_value text;
  applied_rate numeric(20,10) := 1;
  rate_base text;
  rate_quote text;
  rate_on date;
  rate_org uuid;
  rate_entity uuid;
  functional_amount numeric(18,2);
  valid_accounts integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.post') then raise exception 'Accounting post permission required'; end if;
  if entity_uuid is null then raise exception 'Accounting entity is required for multicurrency posting'; end if;
  if tx_currency !~ '^[A-Z]{3}$' then raise exception 'Transaction currency must use three letters'; end if;
  if transaction_amount is null or transaction_amount <= 0 then raise exception 'Transaction amount must be greater than zero'; end if;
  if debit_account_uuid=credit_account_uuid then raise exception 'Debit and credit accounts must differ'; end if;
  if nullif(btrim(coalesce(entry_code,'')),'') is null then raise exception 'Entry number is required'; end if;

  select functional_currency into functional_currency_value
  from public.accounting_entities
  where id=entity_uuid and org_id=organization_uuid and active;
  if functional_currency_value is null then raise exception 'Active accounting entity not found'; end if;
  functional_currency_value := upper(btrim(functional_currency_value));

  if exists (
    select 1 from public.accounting_periods p
    where p.org_id=organization_uuid and effective_date between p.period_start and p.period_end and p.status in ('closed','locked')
  ) then raise exception 'Accounting period is locked'; end if;

  select count(*) into valid_accounts
  from public.chart_of_accounts
  where org_id=organization_uuid and id in (debit_account_uuid,credit_account_uuid) and active;
  if valid_accounts<>2 then raise exception 'Both accounts must be active and belong to the organization'; end if;

  if tx_currency= functional_currency_value then
    if fx_rate_uuid is not null then raise exception 'Same-currency posting does not require an FX rate record'; end if;
    applied_rate := 1;
  else
    if fx_rate_uuid is null then raise exception 'Registered FX rate is required for foreign-currency posting'; end if;

    select org_id,entity_id,base_currency,quote_currency,rate,rate_date
      into rate_org,rate_entity,rate_base,rate_quote,applied_rate,rate_on
    from public.accounting_fx_rates
    where id=fx_rate_uuid;

    if rate_org is null then raise exception 'FX rate not found'; end if;
    if rate_org<>organization_uuid then raise exception 'FX rate organization mismatch'; end if;
    if rate_entity is not null and rate_entity<>entity_uuid then raise exception 'FX rate entity mismatch'; end if;
    if rate_base<>tx_currency or rate_quote<>functional_currency_value then raise exception 'FX rate currency pair does not match transaction and functional currencies'; end if;
    if rate_on>effective_date then raise exception 'FX rate date cannot be after the journal date'; end if;
  end if;

  functional_amount := round(transaction_amount * applied_rate,2);
  if functional_amount<=0 then raise exception 'Translated functional amount must be greater than zero'; end if;

  insert into public.journal_entries(
    org_id,entity_id,entry_number,entry_date,memo,status,created_by,
    transaction_currency,functional_currency,exchange_rate,fx_rate_id
  ) values (
    organization_uuid,entity_uuid,btrim(entry_code),effective_date,entry_memo,'draft',auth.uid(),
    tx_currency,functional_currency_value,applied_rate,fx_rate_uuid
  ) returning id into journal_uuid;

  insert into public.journal_lines(
    org_id,journal_entry_id,account_id,debit,credit,transaction_debit,transaction_credit
  ) values
    (organization_uuid,journal_uuid,debit_account_uuid,functional_amount,0,transaction_amount,0),
    (organization_uuid,journal_uuid,credit_account_uuid,0,functional_amount,0,transaction_amount);

  if not public.validate_journal_entry(journal_uuid) then raise exception 'Journal entry is not balanced'; end if;
  update public.journal_entries set status='posted' where id=journal_uuid;
  return journal_uuid;
end;
$function$;
