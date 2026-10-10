create table if not exists public.accounting_budgets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.accounting_entities(id) on delete cascade,
  name text not null,
  fiscal_year integer not null check (fiscal_year between 2000 and 2200),
  version integer not null default 1 check (version > 0),
  scenario text not null default 'base',
  status text not null default 'draft' check (status in ('draft','approved','locked','archived')),
  base_currency text not null default 'USD' check (base_currency ~ '^[A-Z]{3}$'),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name, fiscal_year, version)
);

create table if not exists public.accounting_budget_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  budget_id uuid not null references public.accounting_budgets(id) on delete cascade,
  account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  amount numeric(18,2) not null,
  dimension jsonb not null default '{}'::jsonb,
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists accounting_budgets_org_year_idx
  on public.accounting_budgets(org_id, fiscal_year, status);
create index if not exists accounting_budget_lines_budget_idx
  on public.accounting_budget_lines(budget_id, period_start, period_end);
create index if not exists accounting_budget_lines_account_idx
  on public.accounting_budget_lines(org_id, account_id, period_start, period_end);

alter table public.accounting_budgets enable row level security;
alter table public.accounting_budget_lines enable row level security;

drop policy if exists accounting_budgets_read on public.accounting_budgets;
create policy accounting_budgets_read on public.accounting_budgets
  for select using (public.is_org_member(org_id));

drop policy if exists accounting_budgets_insert on public.accounting_budgets;
create policy accounting_budgets_insert on public.accounting_budgets
  for insert with check (public.can_write_accounting_data(org_id) and created_by = auth.uid());

drop policy if exists accounting_budgets_update on public.accounting_budgets;
create policy accounting_budgets_update on public.accounting_budgets
  for update using (public.can_write_accounting_data(org_id))
  with check (public.can_write_accounting_data(org_id));

drop policy if exists accounting_budgets_delete on public.accounting_budgets;
create policy accounting_budgets_delete on public.accounting_budgets
  for delete using (public.can_write_accounting_data(org_id));

drop policy if exists accounting_budget_lines_read on public.accounting_budget_lines;
create policy accounting_budget_lines_read on public.accounting_budget_lines
  for select using (public.is_org_member(org_id));

drop policy if exists accounting_budget_lines_insert on public.accounting_budget_lines;
create policy accounting_budget_lines_insert on public.accounting_budget_lines
  for insert with check (public.can_write_accounting_data(org_id) and created_by = auth.uid());

drop policy if exists accounting_budget_lines_update on public.accounting_budget_lines;
create policy accounting_budget_lines_update on public.accounting_budget_lines
  for update using (public.can_write_accounting_data(org_id))
  with check (public.can_write_accounting_data(org_id));

drop policy if exists accounting_budget_lines_delete on public.accounting_budget_lines;
create policy accounting_budget_lines_delete on public.accounting_budget_lines
  for delete using (public.can_write_accounting_data(org_id));

create or replace function public.guard_accounting_budget_change()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.created_by := auth.uid();
    new.approved_by := null;
    new.approved_at := null;
    new.updated_at := now();
    return new;
  end if;

  if old.status = 'locked' then
    raise exception 'Locked budget versions are immutable';
  end if;

  if old.status is distinct from new.status then
    if not public.has_identity_permission(new.org_id,'accounting.admin') then
      raise exception 'Accounting admin permission required for budget status changes';
    end if;
    if new.status in ('approved','locked') then
      new.approved_by := auth.uid();
      new.approved_at := now();
    elsif new.status = 'draft' then
      new.approved_by := null;
      new.approved_at := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists accounting_budgets_guard on public.accounting_budgets;
create trigger accounting_budgets_guard
before insert or update on public.accounting_budgets
for each row execute function public.guard_accounting_budget_change();

create or replace function public.guard_accounting_budget_line_change()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  source_org uuid;
  source_status text;
  target_org uuid;
  target_budget uuid;
  target_account uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  target_org := case when tg_op='DELETE' then old.org_id else new.org_id end;
  target_budget := case when tg_op='DELETE' then old.budget_id else new.budget_id end;
  target_account := case when tg_op='DELETE' then old.account_id else new.account_id end;

  select org_id,status into source_org,source_status
  from public.accounting_budgets where id=target_budget;
  if source_org is null then raise exception 'Budget not found'; end if;
  if source_org <> target_org then raise exception 'Budget organization mismatch'; end if;
  if source_status <> 'draft' then raise exception 'Only draft budgets can change lines'; end if;

  if not exists(
    select 1 from public.chart_of_accounts
    where id=target_account and org_id=target_org and active
  ) then raise exception 'Budget account must be active and belong to the organization'; end if;

  if tg_op <> 'DELETE' then new.updated_at := now(); return new; end if;
  return old;
end;
$function$;

drop trigger if exists accounting_budget_lines_guard on public.accounting_budget_lines;
create trigger accounting_budget_lines_guard
before insert or update or delete on public.accounting_budget_lines
for each row execute function public.guard_accounting_budget_line_change();

create or replace function public.create_accounting_budget(
  organization_uuid uuid,
  entity_uuid uuid,
  budget_name text,
  fiscal_year_value integer,
  version_value integer,
  scenario_value text,
  base_currency_value text
)
returns uuid
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare budget_uuid uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.write') then raise exception 'Accounting write permission required'; end if;
  if nullif(btrim(coalesce(budget_name,'')),'') is null then raise exception 'Budget name is required'; end if;
  if fiscal_year_value not between 2000 and 2200 then raise exception 'Fiscal year is invalid'; end if;
  if version_value is null or version_value <= 0 then raise exception 'Budget version must be positive'; end if;
  if upper(btrim(coalesce(base_currency_value,''))) !~ '^[A-Z]{3}$' then raise exception 'Base currency must be a three-letter code'; end if;

  if entity_uuid is not null and not exists(
    select 1 from public.accounting_entities where id=entity_uuid and org_id=organization_uuid
  ) then raise exception 'Accounting entity organization mismatch'; end if;

  insert into public.accounting_budgets(org_id,entity_id,name,fiscal_year,version,scenario,base_currency,created_by)
  values(organization_uuid,entity_uuid,btrim(budget_name),fiscal_year_value,version_value,coalesce(nullif(btrim(scenario_value),''),'base'),upper(btrim(base_currency_value)),auth.uid())
  returning id into budget_uuid;
  return budget_uuid;
exception when unique_violation then
  raise exception 'Budget version already exists';
end;
$function$;

create or replace function public.add_accounting_budget_line(
  organization_uuid uuid,
  budget_uuid uuid,
  account_uuid uuid,
  period_start_date date,
  period_end_date date,
  budget_amount numeric,
  dimension_value jsonb,
  note_value text
)
returns uuid
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare line_uuid uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.write') then raise exception 'Accounting write permission required'; end if;
  if period_start_date is null or period_end_date is null or period_end_date < period_start_date then raise exception 'Budget period is invalid'; end if;
  if budget_amount is null then raise exception 'Budget amount is required'; end if;

  insert into public.accounting_budget_lines(org_id,budget_id,account_id,period_start,period_end,amount,dimension,note,created_by)
  values(organization_uuid,budget_uuid,account_uuid,period_start_date,period_end_date,budget_amount,coalesce(dimension_value,'{}'::jsonb),nullif(btrim(note_value),''),auth.uid())
  returning id into line_uuid;
  return line_uuid;
end;
$function$;

create or replace function public.set_accounting_budget_status(
  organization_uuid uuid,
  budget_uuid uuid,
  status_value text
)
returns uuid
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare requested_status text := lower(btrim(status_value));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.admin') then raise exception 'Accounting admin permission required'; end if;
  if requested_status not in ('draft','approved','locked','archived') then raise exception 'Unsupported budget status'; end if;

  update public.accounting_budgets
  set status=requested_status
  where id=budget_uuid and org_id=organization_uuid;
  if not found then raise exception 'Budget not found in active organization'; end if;
  return budget_uuid;
end;
$function$;

drop trigger if exists accounting_budgets_audit on public.accounting_budgets;
create trigger accounting_budgets_audit
after insert or update or delete on public.accounting_budgets
for each row execute function public.audit_row_change();

drop trigger if exists accounting_budget_lines_audit on public.accounting_budget_lines;
create trigger accounting_budget_lines_audit
after insert or update or delete on public.accounting_budget_lines
for each row execute function public.audit_row_change();
