create table if not exists public.accounting_consolidation_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  parent_entity_id uuid references public.accounting_entities(id) on delete restrict,
  name text not null,
  reporting_currency text not null,
  status text not null default 'active' check (status in ('active','locked','archived')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name),
  check (reporting_currency ~ '^[A-Z]{3}$')
);

create table if not exists public.accounting_consolidation_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null references public.accounting_consolidation_groups(id) on delete cascade,
  entity_id uuid not null references public.accounting_entities(id) on delete restrict,
  consolidation_method text not null default 'full' check (consolidation_method in ('full','proportional')),
  ownership_pct numeric(7,4) not null default 100 check (ownership_pct > 0 and ownership_pct <= 100),
  effective_from date not null default current_date,
  effective_to date,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.accounting_intercompany_matches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null references public.accounting_consolidation_groups(id) on delete cascade,
  match_reference text not null,
  source_line_id uuid not null references public.journal_lines(id) on delete restrict,
  counterparty_line_id uuid not null references public.journal_lines(id) on delete restrict,
  source_entity_id uuid not null references public.accounting_entities(id) on delete restrict,
  counterparty_entity_id uuid not null references public.accounting_entities(id) on delete restrict,
  reporting_currency text not null,
  source_reporting_amount numeric(20,2) not null,
  counterparty_reporting_amount numeric(20,2) not null,
  difference numeric(20,2) not null,
  tolerance numeric(20,2) not null default 0.01 check (tolerance >= 0),
  status text not null check (status in ('matched','exception','eliminated')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, source_line_id, counterparty_line_id),
  check (source_line_id <> counterparty_line_id),
  check (source_entity_id <> counterparty_entity_id),
  check (reporting_currency ~ '^[A-Z]{3}$')
);

create table if not exists public.accounting_consolidation_adjustments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null references public.accounting_consolidation_groups(id) on delete cascade,
  source_match_id uuid references public.accounting_intercompany_matches(id) on delete restrict,
  adjustment_date date not null,
  reference text not null,
  reason text not null,
  status text not null default 'draft' check (status in ('draft','posted','locked')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, reference),
  unique (source_match_id)
);

create table if not exists public.accounting_consolidation_adjustment_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  adjustment_id uuid not null references public.accounting_consolidation_adjustments(id) on delete cascade,
  account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  source_journal_line_id uuid references public.journal_lines(id) on delete restrict,
  debit numeric(20,2) not null default 0 check (debit >= 0),
  credit numeric(20,2) not null default 0 check (credit >= 0),
  memo text,
  created_at timestamptz not null default now(),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create index if not exists accounting_consolidation_members_group_idx
  on public.accounting_consolidation_members(group_id, entity_id, effective_from, effective_to);
create index if not exists accounting_intercompany_matches_group_idx
  on public.accounting_intercompany_matches(group_id, status, created_at desc);
create index if not exists accounting_consolidation_adjustments_group_date_idx
  on public.accounting_consolidation_adjustments(group_id, adjustment_date, status);
create index if not exists accounting_consolidation_adjustment_lines_adjustment_idx
  on public.accounting_consolidation_adjustment_lines(adjustment_id, account_id);

alter table public.accounting_consolidation_groups enable row level security;
alter table public.accounting_consolidation_members enable row level security;
alter table public.accounting_intercompany_matches enable row level security;
alter table public.accounting_consolidation_adjustments enable row level security;
alter table public.accounting_consolidation_adjustment_lines enable row level security;

drop policy if exists accounting_consolidation_groups_read on public.accounting_consolidation_groups;
create policy accounting_consolidation_groups_read on public.accounting_consolidation_groups
for select using (public.is_org_member(org_id));
drop policy if exists accounting_consolidation_groups_insert on public.accounting_consolidation_groups;
create policy accounting_consolidation_groups_insert on public.accounting_consolidation_groups
for insert with check (public.has_identity_permission(org_id,'accounting.admin'));
drop policy if exists accounting_consolidation_groups_update on public.accounting_consolidation_groups;
create policy accounting_consolidation_groups_update on public.accounting_consolidation_groups
for update using (public.has_identity_permission(org_id,'accounting.admin'))
with check (public.has_identity_permission(org_id,'accounting.admin'));
drop policy if exists accounting_consolidation_groups_delete on public.accounting_consolidation_groups;
create policy accounting_consolidation_groups_delete on public.accounting_consolidation_groups
for delete using (public.has_identity_permission(org_id,'accounting.admin'));

drop policy if exists accounting_consolidation_members_read on public.accounting_consolidation_members;
create policy accounting_consolidation_members_read on public.accounting_consolidation_members
for select using (public.is_org_member(org_id));
drop policy if exists accounting_consolidation_members_insert on public.accounting_consolidation_members;
create policy accounting_consolidation_members_insert on public.accounting_consolidation_members
for insert with check (public.has_identity_permission(org_id,'accounting.admin'));
drop policy if exists accounting_consolidation_members_update on public.accounting_consolidation_members;
create policy accounting_consolidation_members_update on public.accounting_consolidation_members
for update using (public.has_identity_permission(org_id,'accounting.admin'))
with check (public.has_identity_permission(org_id,'accounting.admin'));
drop policy if exists accounting_consolidation_members_delete on public.accounting_consolidation_members;
create policy accounting_consolidation_members_delete on public.accounting_consolidation_members
for delete using (public.has_identity_permission(org_id,'accounting.admin'));

drop policy if exists accounting_intercompany_matches_read on public.accounting_intercompany_matches;
create policy accounting_intercompany_matches_read on public.accounting_intercompany_matches
for select using (public.is_org_member(org_id));
drop policy if exists accounting_intercompany_matches_insert on public.accounting_intercompany_matches;
create policy accounting_intercompany_matches_insert on public.accounting_intercompany_matches
for insert with check (public.can_write_accounting_data(org_id));
drop policy if exists accounting_intercompany_matches_update on public.accounting_intercompany_matches;
create policy accounting_intercompany_matches_update on public.accounting_intercompany_matches
for update using (public.can_write_accounting_data(org_id))
with check (public.can_write_accounting_data(org_id));
drop policy if exists accounting_intercompany_matches_delete on public.accounting_intercompany_matches;
create policy accounting_intercompany_matches_delete on public.accounting_intercompany_matches
for delete using (public.has_identity_permission(org_id,'accounting.admin'));

drop policy if exists accounting_consolidation_adjustments_read on public.accounting_consolidation_adjustments;
create policy accounting_consolidation_adjustments_read on public.accounting_consolidation_adjustments
for select using (public.is_org_member(org_id));
drop policy if exists accounting_consolidation_adjustments_insert on public.accounting_consolidation_adjustments;
create policy accounting_consolidation_adjustments_insert on public.accounting_consolidation_adjustments
for insert with check (public.has_identity_permission(org_id,'accounting.post'));
drop policy if exists accounting_consolidation_adjustments_update on public.accounting_consolidation_adjustments;
create policy accounting_consolidation_adjustments_update on public.accounting_consolidation_adjustments
for update using (public.has_identity_permission(org_id,'accounting.post'))
with check (public.has_identity_permission(org_id,'accounting.post'));
drop policy if exists accounting_consolidation_adjustments_delete on public.accounting_consolidation_adjustments;
create policy accounting_consolidation_adjustments_delete on public.accounting_consolidation_adjustments
for delete using (public.has_identity_permission(org_id,'accounting.admin'));

drop policy if exists accounting_consolidation_adjustment_lines_read on public.accounting_consolidation_adjustment_lines;
create policy accounting_consolidation_adjustment_lines_read on public.accounting_consolidation_adjustment_lines
for select using (public.is_org_member(org_id));
drop policy if exists accounting_consolidation_adjustment_lines_insert on public.accounting_consolidation_adjustment_lines;
create policy accounting_consolidation_adjustment_lines_insert on public.accounting_consolidation_adjustment_lines
for insert with check (public.has_identity_permission(org_id,'accounting.post'));
drop policy if exists accounting_consolidation_adjustment_lines_update on public.accounting_consolidation_adjustment_lines;
create policy accounting_consolidation_adjustment_lines_update on public.accounting_consolidation_adjustment_lines
for update using (public.has_identity_permission(org_id,'accounting.post'))
with check (public.has_identity_permission(org_id,'accounting.post'));
drop policy if exists accounting_consolidation_adjustment_lines_delete on public.accounting_consolidation_adjustment_lines;
create policy accounting_consolidation_adjustment_lines_delete on public.accounting_consolidation_adjustment_lines
for delete using (public.has_identity_permission(org_id,'accounting.post'));

create or replace function public.accounting_group_reporting_rate(
  organization_uuid uuid,
  entity_uuid uuid,
  from_currency_value text,
  reporting_currency_value text,
  as_of_date date
) returns numeric
language plpgsql
stable
set search_path to 'public','pg_temp'
as $$
declare
  from_currency text := upper(btrim(from_currency_value));
  reporting_currency text := upper(btrim(reporting_currency_value));
  resolved_rate numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(organization_uuid) then raise exception 'Organization membership required'; end if;
  if from_currency !~ '^[A-Z]{3}$' or reporting_currency !~ '^[A-Z]{3}$' then
    raise exception 'Currency code must use three letters';
  end if;
  if from_currency = reporting_currency then return 1; end if;

  select r.rate into resolved_rate
  from public.accounting_fx_rates r
  where r.org_id = organization_uuid
    and r.base_currency = from_currency
    and r.quote_currency = reporting_currency
    and r.rate_date <= as_of_date
    and (r.entity_id = entity_uuid or r.entity_id is null)
  order by (r.entity_id = entity_uuid) desc, r.rate_date desc, r.created_at desc
  limit 1;

  if resolved_rate is not null and resolved_rate > 0 then return resolved_rate; end if;

  select (1 / r.rate) into resolved_rate
  from public.accounting_fx_rates r
  where r.org_id = organization_uuid
    and r.base_currency = reporting_currency
    and r.quote_currency = from_currency
    and r.rate_date <= as_of_date
    and r.rate > 0
    and (r.entity_id = entity_uuid or r.entity_id is null)
  order by (r.entity_id = entity_uuid) desc, r.rate_date desc, r.created_at desc
  limit 1;

  if resolved_rate is null or resolved_rate <= 0 then
    raise exception 'Missing FX rate from % to % on or before %', from_currency, reporting_currency, as_of_date;
  end if;
  return resolved_rate;
end;
$$;

create or replace function public.guard_accounting_consolidation_group()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare
  parent_org uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(coalesce(new.org_id,old.org_id),'accounting.admin') then
    raise exception 'Accounting admin permission required';
  end if;

  if tg_op = 'DELETE' then
    if exists(select 1 from public.accounting_consolidation_members m where m.group_id=old.id)
       or exists(select 1 from public.accounting_intercompany_matches m where m.group_id=old.id)
       or exists(select 1 from public.accounting_consolidation_adjustments a where a.group_id=old.id) then
      raise exception 'Consolidation group with history cannot be deleted';
    end if;
    return old;
  end if;

  new.name := btrim(new.name);
  new.reporting_currency := upper(btrim(new.reporting_currency));
  if new.name = '' then raise exception 'Consolidation group name is required'; end if;
  if new.reporting_currency !~ '^[A-Z]{3}$' then raise exception 'Reporting currency must use three letters'; end if;

  if new.parent_entity_id is not null then
    select org_id into parent_org from public.accounting_entities where id=new.parent_entity_id;
    if parent_org is null or parent_org <> new.org_id then raise exception 'Parent entity must belong to the organization'; end if;
  end if;

  if tg_op='INSERT' then
    new.status := 'active';
    new.created_by := auth.uid();
  elsif old.status='locked' and (new.status <> 'archived' or row(new.name,new.reporting_currency,new.parent_entity_id) is distinct from row(old.name,old.reporting_currency,old.parent_entity_id)) then
    raise exception 'Locked consolidation group is immutable except archive transition';
  elsif old.reporting_currency is distinct from new.reporting_currency and (
    exists(select 1 from public.accounting_intercompany_matches m where m.group_id=old.id)
    or exists(select 1 from public.accounting_consolidation_adjustments a where a.group_id=old.id)
  ) then
    raise exception 'Reporting currency cannot change after consolidation activity exists';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.guard_accounting_consolidation_member()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare
  group_org uuid;
  group_status text;
  entity_org uuid;
  row_id uuid := case when tg_op='DELETE' then old.id else new.id end;
  target_group uuid := case when tg_op='DELETE' then old.group_id else new.group_id end;
  target_entity uuid := case when tg_op='DELETE' then old.entity_id else new.entity_id end;
  target_org uuid := case when tg_op='DELETE' then old.org_id else new.org_id end;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(target_org,'accounting.admin') then raise exception 'Accounting admin permission required'; end if;

  select org_id,status into group_org,group_status from public.accounting_consolidation_groups where id=target_group;
  select org_id into entity_org from public.accounting_entities where id=target_entity;
  if group_org is null then raise exception 'Consolidation group not found'; end if;
  if group_org <> target_org or entity_org is null or entity_org <> target_org then raise exception 'Consolidation membership organization mismatch'; end if;
  if group_status <> 'active' then raise exception 'Consolidation membership requires an active group'; end if;

  if tg_op='DELETE' then return old; end if;
  if new.effective_to is not null and new.effective_to < new.effective_from then raise exception 'Membership effective range is invalid'; end if;
  if exists(
    select 1 from public.accounting_consolidation_members m
    where m.group_id=new.group_id and m.entity_id=new.entity_id and m.id<>row_id
      and daterange(m.effective_from,coalesce(m.effective_to,'infinity'::date),'[]') && daterange(new.effective_from,coalesce(new.effective_to,'infinity'::date),'[]')
  ) then raise exception 'Consolidation membership periods cannot overlap'; end if;
  if tg_op='INSERT' then new.created_by := auth.uid(); end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.guard_accounting_intercompany_match()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare
  group_org uuid;
  group_status text;
  group_currency text;
  source_account uuid;
  source_debit numeric;
  source_credit numeric;
  source_entity uuid;
  source_date date;
  source_currency text;
  source_status text;
  counterparty_account uuid;
  counterparty_debit numeric;
  counterparty_credit numeric;
  counterparty_entity uuid;
  counterparty_date date;
  counterparty_currency text;
  counterparty_status text;
  source_rate numeric;
  counterparty_rate numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if tg_op='DELETE' then
    if old.status='eliminated' then raise exception 'Eliminated intercompany match cannot be deleted'; end if;
    if not public.has_identity_permission(old.org_id,'accounting.admin') then raise exception 'Accounting admin permission required'; end if;
    return old;
  end if;

  if tg_op='UPDATE' then
    if old.status='eliminated' then raise exception 'Eliminated intercompany match is immutable'; end if;
    if row(new.group_id,new.match_reference,new.source_line_id,new.counterparty_line_id,new.tolerance) is distinct from row(old.group_id,old.match_reference,old.source_line_id,old.counterparty_line_id,old.tolerance) then
      raise exception 'Intercompany match evidence is immutable; recreate the match instead';
    end if;
    if new.status='eliminated' then
      if not public.has_identity_permission(old.org_id,'accounting.post') then raise exception 'Accounting post permission required'; end if;
      if not exists(select 1 from public.accounting_consolidation_adjustments a where a.source_match_id=old.id and a.status in ('posted','locked')) then
        raise exception 'Posted elimination adjustment is required';
      end if;
      new.updated_at := now();
      return new;
    end if;
    raise exception 'Intercompany match status is derived and cannot be edited directly';
  end if;

  if not public.can_write_accounting_data(new.org_id) then raise exception 'Accounting write permission required'; end if;
  new.match_reference := btrim(new.match_reference);
  if new.match_reference='' then raise exception 'Intercompany match reference is required'; end if;
  if new.source_line_id=new.counterparty_line_id then raise exception 'Intercompany lines must differ'; end if;

  select org_id,status,reporting_currency into group_org,group_status,group_currency
  from public.accounting_consolidation_groups where id=new.group_id;
  if group_org is null or group_org<>new.org_id then raise exception 'Consolidation group organization mismatch'; end if;
  if group_status<>'active' then raise exception 'Intercompany matching requires an active consolidation group'; end if;

  select jl.account_id,coalesce(jl.debit,0),coalesce(jl.credit,0),je.entity_id,je.entry_date,
         coalesce(je.functional_currency,e.functional_currency),je.status
    into source_account,source_debit,source_credit,source_entity,source_date,source_currency,source_status
  from public.journal_lines jl
  join public.journal_entries je on je.id=jl.journal_entry_id
  join public.accounting_entities e on e.id=je.entity_id
  where jl.id=new.source_line_id and jl.org_id=new.org_id and je.org_id=new.org_id;

  select jl.account_id,coalesce(jl.debit,0),coalesce(jl.credit,0),je.entity_id,je.entry_date,
         coalesce(je.functional_currency,e.functional_currency),je.status
    into counterparty_account,counterparty_debit,counterparty_credit,counterparty_entity,counterparty_date,counterparty_currency,counterparty_status
  from public.journal_lines jl
  join public.journal_entries je on je.id=jl.journal_entry_id
  join public.accounting_entities e on e.id=je.entity_id
  where jl.id=new.counterparty_line_id and jl.org_id=new.org_id and je.org_id=new.org_id;

  if source_account is null or counterparty_account is null then raise exception 'Intercompany journal line not found'; end if;
  if source_status<>'posted' or counterparty_status<>'posted' then raise exception 'Only posted journal lines can be matched'; end if;
  if source_entity is null or counterparty_entity is null or source_entity=counterparty_entity then raise exception 'Intercompany lines must belong to different entities'; end if;
  if not ((source_debit>0 and source_credit=0 and counterparty_credit>0 and counterparty_debit=0)
       or (source_credit>0 and source_debit=0 and counterparty_debit>0 and counterparty_credit=0)) then
    raise exception 'Intercompany lines must have opposite debit/credit direction';
  end if;
  if not exists(select 1 from public.accounting_consolidation_members m where m.group_id=new.group_id and m.entity_id=source_entity and source_date between m.effective_from and coalesce(m.effective_to,'infinity'::date))
     or not exists(select 1 from public.accounting_consolidation_members m where m.group_id=new.group_id and m.entity_id=counterparty_entity and counterparty_date between m.effective_from and coalesce(m.effective_to,'infinity'::date)) then
    raise exception 'Both entities must be active consolidation members on the journal dates';
  end if;

  source_rate := public.accounting_group_reporting_rate(new.org_id,source_entity,source_currency,group_currency,source_date);
  counterparty_rate := public.accounting_group_reporting_rate(new.org_id,counterparty_entity,counterparty_currency,group_currency,counterparty_date);

  new.source_entity_id := source_entity;
  new.counterparty_entity_id := counterparty_entity;
  new.reporting_currency := group_currency;
  new.source_reporting_amount := round(abs(source_debit-source_credit)*source_rate,2);
  new.counterparty_reporting_amount := round(abs(counterparty_debit-counterparty_credit)*counterparty_rate,2);
  new.difference := abs(new.source_reporting_amount-new.counterparty_reporting_amount);
  new.tolerance := round(coalesce(new.tolerance,0.01),2);
  if new.tolerance<0 then raise exception 'Tolerance must be nonnegative'; end if;
  new.status := case when new.difference<=new.tolerance then 'matched' else 'exception' end;
  new.created_by := auth.uid();
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.validate_accounting_consolidation_adjustment(adjustment_uuid uuid)
returns boolean
language sql
stable
set search_path to 'public','pg_temp'
as $$
select coalesce(sum(debit),0)=coalesce(sum(credit),0) and coalesce(sum(debit),0)>0
from public.accounting_consolidation_adjustment_lines
where adjustment_id=adjustment_uuid
$$;

create or replace function public.guard_accounting_consolidation_adjustment()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare
  group_org uuid;
  group_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if tg_op='DELETE' then
    if old.status<>'draft' then raise exception 'Posted consolidation adjustment is immutable'; end if;
    if not public.has_identity_permission(old.org_id,'accounting.admin') then raise exception 'Accounting admin permission required'; end if;
    return old;
  end if;

  if not public.has_identity_permission(new.org_id,'accounting.post') then raise exception 'Accounting post permission required'; end if;
  select org_id,status into group_org,group_status from public.accounting_consolidation_groups where id=new.group_id;
  if group_org is null or group_org<>new.org_id then raise exception 'Consolidation group organization mismatch'; end if;
  if group_status='archived' then raise exception 'Archived consolidation group cannot receive adjustments'; end if;

  new.reference := btrim(new.reference);
  new.reason := btrim(new.reason);
  if new.reference='' or new.reason='' then raise exception 'Adjustment reference and reason are required'; end if;

  if tg_op='INSERT' then
    new.status := 'draft';
    new.created_by := auth.uid();
    new.posted_by := null;
    new.posted_at := null;
  elsif old.status in ('posted','locked') then
    if old.status='posted' and new.status='locked' and public.has_identity_permission(new.org_id,'accounting.admin') then
      new.updated_at := now();
      return new;
    end if;
    raise exception 'Posted consolidation adjustment is immutable';
  elsif new.status='posted' then
    if not public.validate_accounting_consolidation_adjustment(new.id) then raise exception 'Consolidation adjustment must be balanced before posting'; end if;
    new.posted_by := auth.uid();
    new.posted_at := now();
  elsif new.status<>'draft' then
    raise exception 'Unsupported consolidation adjustment transition';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.guard_accounting_consolidation_adjustment_line()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare
  adjustment_org uuid;
  adjustment_status text;
  account_org uuid;
  source_org uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select org_id,status into adjustment_org,adjustment_status
  from public.accounting_consolidation_adjustments
  where id=case when tg_op='DELETE' then old.adjustment_id else new.adjustment_id end;
  if adjustment_org is null then raise exception 'Consolidation adjustment not found'; end if;
  if not public.has_identity_permission(adjustment_org,'accounting.post') then raise exception 'Accounting post permission required'; end if;
  if adjustment_status<>'draft' then raise exception 'Only draft consolidation adjustment lines can change'; end if;
  if tg_op='DELETE' then return old; end if;

  if new.org_id<>adjustment_org then raise exception 'Consolidation adjustment line organization mismatch'; end if;
  select org_id into account_org from public.chart_of_accounts where id=new.account_id;
  if account_org is null or account_org<>new.org_id then raise exception 'Consolidation account must belong to the organization'; end if;
  if new.source_journal_line_id is not null then
    select org_id into source_org from public.journal_lines where id=new.source_journal_line_id;
    if source_org is null or source_org<>new.org_id then raise exception 'Source journal line organization mismatch'; end if;
  end if;
  if coalesce(new.debit,0)<0 or coalesce(new.credit,0)<0 or not ((coalesce(new.debit,0)>0 and coalesce(new.credit,0)=0) or (coalesce(new.credit,0)>0 and coalesce(new.debit,0)=0)) then
    raise exception 'Consolidation line must contain exactly one positive debit or credit';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_accounting_consolidation_group on public.accounting_consolidation_groups;
create trigger guard_accounting_consolidation_group before insert or update or delete on public.accounting_consolidation_groups
for each row execute function public.guard_accounting_consolidation_group();
drop trigger if exists guard_accounting_consolidation_member on public.accounting_consolidation_members;
create trigger guard_accounting_consolidation_member before insert or update or delete on public.accounting_consolidation_members
for each row execute function public.guard_accounting_consolidation_member();
drop trigger if exists guard_accounting_intercompany_match on public.accounting_intercompany_matches;
create trigger guard_accounting_intercompany_match before insert or update or delete on public.accounting_intercompany_matches
for each row execute function public.guard_accounting_intercompany_match();
drop trigger if exists guard_accounting_consolidation_adjustment on public.accounting_consolidation_adjustments;
create trigger guard_accounting_consolidation_adjustment before insert or update or delete on public.accounting_consolidation_adjustments
for each row execute function public.guard_accounting_consolidation_adjustment();
drop trigger if exists guard_accounting_consolidation_adjustment_line on public.accounting_consolidation_adjustment_lines;
create trigger guard_accounting_consolidation_adjustment_line before insert or update or delete on public.accounting_consolidation_adjustment_lines
for each row execute function public.guard_accounting_consolidation_adjustment_line();

drop trigger if exists audit_accounting_consolidation_groups on public.accounting_consolidation_groups;
create trigger audit_accounting_consolidation_groups after insert or update or delete on public.accounting_consolidation_groups
for each row execute function public.audit_row_change();
drop trigger if exists audit_accounting_consolidation_members on public.accounting_consolidation_members;
create trigger audit_accounting_consolidation_members after insert or update or delete on public.accounting_consolidation_members
for each row execute function public.audit_row_change();
drop trigger if exists audit_accounting_intercompany_matches on public.accounting_intercompany_matches;
create trigger audit_accounting_intercompany_matches after insert or update or delete on public.accounting_intercompany_matches
for each row execute function public.audit_row_change();
drop trigger if exists audit_accounting_consolidation_adjustments on public.accounting_consolidation_adjustments;
create trigger audit_accounting_consolidation_adjustments after insert or update or delete on public.accounting_consolidation_adjustments
for each row execute function public.audit_row_change();
drop trigger if exists audit_accounting_consolidation_adjustment_lines on public.accounting_consolidation_adjustment_lines;
create trigger audit_accounting_consolidation_adjustment_lines after insert or update or delete on public.accounting_consolidation_adjustment_lines
for each row execute function public.audit_row_change();

create or replace function public.create_accounting_consolidation_group(
  organization_uuid uuid,
  group_name text,
  reporting_currency_value text,
  parent_entity_uuid uuid default null
) returns uuid
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare group_uuid uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.admin') then raise exception 'Accounting admin permission required'; end if;
  insert into public.accounting_consolidation_groups(org_id,parent_entity_id,name,reporting_currency)
  values(organization_uuid,parent_entity_uuid,group_name,upper(btrim(reporting_currency_value))) returning id into group_uuid;
  return group_uuid;
end;
$$;

create or replace function public.add_accounting_consolidation_member(
  organization_uuid uuid,
  group_uuid uuid,
  entity_uuid uuid,
  consolidation_method_value text,
  ownership_pct_value numeric,
  effective_from_value date,
  effective_to_value date default null
) returns uuid
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare member_uuid uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.admin') then raise exception 'Accounting admin permission required'; end if;
  insert into public.accounting_consolidation_members(org_id,group_id,entity_id,consolidation_method,ownership_pct,effective_from,effective_to)
  values(organization_uuid,group_uuid,entity_uuid,lower(btrim(consolidation_method_value)),ownership_pct_value,effective_from_value,effective_to_value)
  returning id into member_uuid;
  return member_uuid;
end;
$$;

create or replace function public.match_accounting_intercompany_lines(
  organization_uuid uuid,
  group_uuid uuid,
  match_reference_value text,
  source_line_uuid uuid,
  counterparty_line_uuid uuid,
  tolerance_value numeric default 0.01
) returns uuid
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare match_uuid uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_write_accounting_data(organization_uuid) then raise exception 'Accounting write permission required'; end if;
  insert into public.accounting_intercompany_matches(
    org_id,group_id,match_reference,source_line_id,counterparty_line_id,
    source_entity_id,counterparty_entity_id,reporting_currency,source_reporting_amount,counterparty_reporting_amount,difference,tolerance,status
  ) values (
    organization_uuid,group_uuid,match_reference_value,source_line_uuid,counterparty_line_uuid,
    organization_uuid,organization_uuid,'USD',0,0,0,tolerance_value,'exception'
  ) returning id into match_uuid;
  return match_uuid;
end;
$$;

create or replace function public.create_accounting_intercompany_elimination(
  organization_uuid uuid,
  match_uuid uuid,
  adjustment_on date,
  adjustment_reference text,
  adjustment_reason text,
  rounding_account_uuid uuid default null
) returns uuid
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare
  matched public.accounting_intercompany_matches%rowtype;
  source_debit numeric;
  source_credit numeric;
  source_account uuid;
  counterparty_debit numeric;
  counterparty_credit numeric;
  counterparty_account uuid;
  adjustment_uuid uuid;
  total_debit numeric;
  total_credit numeric;
  difference_amount numeric;
  rounding_org uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.post') then raise exception 'Accounting post permission required'; end if;

  select * into matched from public.accounting_intercompany_matches
  where id=match_uuid and org_id=organization_uuid for update;
  if matched.id is null then raise exception 'Intercompany match not found'; end if;
  if matched.status<>'matched' then raise exception 'Only matched intercompany lines can be eliminated'; end if;

  select account_id,coalesce(debit,0),coalesce(credit,0) into source_account,source_debit,source_credit
  from public.journal_lines where id=matched.source_line_id;
  select account_id,coalesce(debit,0),coalesce(credit,0) into counterparty_account,counterparty_debit,counterparty_credit
  from public.journal_lines where id=matched.counterparty_line_id;

  insert into public.accounting_consolidation_adjustments(org_id,group_id,source_match_id,adjustment_date,reference,reason,status)
  values(organization_uuid,matched.group_id,matched.id,coalesce(adjustment_on,current_date),adjustment_reference,adjustment_reason,'draft')
  returning id into adjustment_uuid;

  insert into public.accounting_consolidation_adjustment_lines(org_id,adjustment_id,account_id,source_journal_line_id,debit,credit,memo)
  values(
    organization_uuid,adjustment_uuid,source_account,matched.source_line_id,
    case when source_credit>0 then matched.source_reporting_amount else 0 end,
    case when source_debit>0 then matched.source_reporting_amount else 0 end,
    'Reverse source intercompany line'
  );
  insert into public.accounting_consolidation_adjustment_lines(org_id,adjustment_id,account_id,source_journal_line_id,debit,credit,memo)
  values(
    organization_uuid,adjustment_uuid,counterparty_account,matched.counterparty_line_id,
    case when counterparty_credit>0 then matched.counterparty_reporting_amount else 0 end,
    case when counterparty_debit>0 then matched.counterparty_reporting_amount else 0 end,
    'Reverse counterparty intercompany line'
  );

  select coalesce(sum(debit),0),coalesce(sum(credit),0) into total_debit,total_credit
  from public.accounting_consolidation_adjustment_lines where adjustment_id=adjustment_uuid;
  difference_amount := round(abs(total_debit-total_credit),2);

  if difference_amount>0 then
    if rounding_account_uuid is null then raise exception 'Rounding account is required for nonzero intercompany difference'; end if;
    select org_id into rounding_org from public.chart_of_accounts where id=rounding_account_uuid;
    if rounding_org is null or rounding_org<>organization_uuid then raise exception 'Rounding account must belong to the organization'; end if;
    insert into public.accounting_consolidation_adjustment_lines(org_id,adjustment_id,account_id,debit,credit,memo)
    values(
      organization_uuid,adjustment_uuid,rounding_account_uuid,
      case when total_debit<total_credit then difference_amount else 0 end,
      case when total_credit<total_debit then difference_amount else 0 end,
      'Intercompany FX/rounding difference'
    );
  end if;

  update public.accounting_consolidation_adjustments set status='posted' where id=adjustment_uuid;
  update public.accounting_intercompany_matches set status='eliminated' where id=matched.id;
  return adjustment_uuid;
end;
$$;

create or replace function public.create_accounting_consolidation_adjustment(
  organization_uuid uuid,
  group_uuid uuid,
  adjustment_on date,
  adjustment_reference text,
  adjustment_reason text,
  debit_account_uuid uuid,
  credit_account_uuid uuid,
  adjustment_amount numeric
) returns uuid
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare adjustment_uuid uuid; valid_accounts integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.post') then raise exception 'Accounting post permission required'; end if;
  if adjustment_amount is null or adjustment_amount<=0 then raise exception 'Adjustment amount must be greater than zero'; end if;
  if debit_account_uuid=credit_account_uuid then raise exception 'Debit and credit accounts must differ'; end if;
  select count(*) into valid_accounts from public.chart_of_accounts where org_id=organization_uuid and active and id in (debit_account_uuid,credit_account_uuid);
  if valid_accounts<>2 then raise exception 'Both consolidation accounts must be active and belong to the organization'; end if;

  insert into public.accounting_consolidation_adjustments(org_id,group_id,adjustment_date,reference,reason,status)
  values(organization_uuid,group_uuid,coalesce(adjustment_on,current_date),adjustment_reference,adjustment_reason,'draft') returning id into adjustment_uuid;
  insert into public.accounting_consolidation_adjustment_lines(org_id,adjustment_id,account_id,debit,credit) values
    (organization_uuid,adjustment_uuid,debit_account_uuid,adjustment_amount,0),
    (organization_uuid,adjustment_uuid,credit_account_uuid,0,adjustment_amount);
  update public.accounting_consolidation_adjustments set status='posted' where id=adjustment_uuid;
  return adjustment_uuid;
end;
$$;

create or replace function public.get_accounting_consolidated_trial_balance(
  organization_uuid uuid,
  group_uuid uuid,
  as_of_date_value date default current_date
) returns table(
  account_id uuid,
  account_number text,
  account_name text,
  debit numeric,
  credit numeric,
  balance numeric,
  reporting_currency text
)
language plpgsql
stable
set search_path to 'public','pg_temp'
as $$
declare group_currency text; group_org uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(organization_uuid) then raise exception 'Organization membership required'; end if;
  select org_id,reporting_currency into group_org,group_currency from public.accounting_consolidation_groups where id=group_uuid;
  if group_org is null or group_org<>organization_uuid then raise exception 'Consolidation group organization mismatch'; end if;

  return query
  with legal_lines as (
    select
      jl.account_id,
      round(coalesce(jl.debit,0)
        * case when m.consolidation_method='full' then 1 else m.ownership_pct/100 end
        * public.accounting_group_reporting_rate(organization_uuid,m.entity_id,coalesce(je.functional_currency,e.functional_currency),group_currency,je.entry_date),2) as debit,
      round(coalesce(jl.credit,0)
        * case when m.consolidation_method='full' then 1 else m.ownership_pct/100 end
        * public.accounting_group_reporting_rate(organization_uuid,m.entity_id,coalesce(je.functional_currency,e.functional_currency),group_currency,je.entry_date),2) as credit
    from public.accounting_consolidation_members m
    join public.accounting_entities e on e.id=m.entity_id and e.org_id=organization_uuid
    join public.journal_entries je on je.entity_id=m.entity_id and je.org_id=organization_uuid and je.status='posted'
    join public.journal_lines jl on jl.journal_entry_id=je.id and jl.org_id=organization_uuid
    where m.group_id=group_uuid
      and je.entry_date<=coalesce(as_of_date_value,current_date)
      and je.entry_date between m.effective_from and coalesce(m.effective_to,'infinity'::date)
  ),
  consolidation_lines as (
    select l.account_id,l.debit,l.credit
    from public.accounting_consolidation_adjustments a
    join public.accounting_consolidation_adjustment_lines l on l.adjustment_id=a.id and l.org_id=organization_uuid
    where a.group_id=group_uuid and a.org_id=organization_uuid and a.status in ('posted','locked')
      and a.adjustment_date<=coalesce(as_of_date_value,current_date)
  ),
  totals as (
    select x.account_id,round(sum(x.debit),2) as debit,round(sum(x.credit),2) as credit
    from (select * from legal_lines union all select * from consolidation_lines) x
    group by x.account_id
  )
  select c.id,c.account_number,c.name,t.debit,t.credit,round(t.debit-t.credit,2),group_currency
  from totals t
  join public.chart_of_accounts c on c.id=t.account_id and c.org_id=organization_uuid
  order by c.account_number,c.name;
end;
$$;
