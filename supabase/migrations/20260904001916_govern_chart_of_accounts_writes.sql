alter table public.chart_of_accounts
  add column if not exists active boolean not null default true;

alter table public.chart_of_accounts
  drop constraint if exists chart_of_accounts_account_type_check;

alter table public.chart_of_accounts
  add constraint chart_of_accounts_account_type_check
  check (account_type in ('asset','liability','equity','revenue','expense'));

create unique index if not exists chart_of_accounts_org_number_unique
  on public.chart_of_accounts (org_id, account_number)
  where org_id is not null;

create or replace function public.create_chart_account(
  organization_uuid uuid,
  account_code text,
  account_name text,
  account_kind text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_write_accounting_data(organization_uuid) then
    raise exception 'Accounting write permission required';
  end if;

  if btrim(coalesce(account_code, '')) = '' then
    raise exception 'Account number is required';
  end if;

  if btrim(coalesce(account_name, '')) = '' then
    raise exception 'Account name is required';
  end if;

  if account_kind not in ('asset','liability','equity','revenue','expense') then
    raise exception 'Unsupported account type';
  end if;

  insert into public.chart_of_accounts (org_id, account_number, name, account_type, active)
  values (organization_uuid, btrim(account_code), btrim(account_name), account_kind, true)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.update_chart_account(
  organization_uuid uuid,
  account_uuid uuid,
  account_code text,
  account_name text,
  account_kind text,
  account_active boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_write_accounting_data(organization_uuid) then
    raise exception 'Accounting write permission required';
  end if;

  if btrim(coalesce(account_code, '')) = '' then
    raise exception 'Account number is required';
  end if;

  if btrim(coalesce(account_name, '')) = '' then
    raise exception 'Account name is required';
  end if;

  if account_kind not in ('asset','liability','equity','revenue','expense') then
    raise exception 'Unsupported account type';
  end if;

  update public.chart_of_accounts
  set account_number = btrim(account_code),
      name = btrim(account_name),
      account_type = account_kind,
      active = coalesce(account_active, active),
      updated_at = now()
  where id = account_uuid
    and org_id = organization_uuid
  returning id into updated_id;

  if updated_id is null then
    raise exception 'Account not found';
  end if;

  return updated_id;
end;
$$;

revoke all on function public.create_chart_account(uuid,text,text,text) from public;
revoke all on function public.update_chart_account(uuid,uuid,text,text,text,boolean) from public;
grant execute on function public.create_chart_account(uuid,text,text,text) to authenticated;
grant execute on function public.update_chart_account(uuid,uuid,text,text,text,boolean) to authenticated;
