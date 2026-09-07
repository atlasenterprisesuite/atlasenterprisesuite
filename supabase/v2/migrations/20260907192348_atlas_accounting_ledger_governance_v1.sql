begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.accounting_audit(
  p_tenant_id uuid,
  p_org_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb,
  p_after jsonb
) returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  insert into public.audit_logs(
    tenant_id, org_id, actor_id, action, entity_type, entity_id,
    before_state, after_state, correlation_id
  ) values (
    p_tenant_id, p_org_id, auth.uid(), p_action, p_entity_type, p_entity_id,
    p_before, p_after, gen_random_uuid()::text
  );
end;
$$;

create or replace function private.require_accounting_permission(
  p_tenant_id uuid,
  p_org_id uuid,
  p_permission text
) returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_identity_permission(p_tenant_id, p_org_id, p_permission) then
    raise exception '% permission required', p_permission;
  end if;
end;
$$;

create or replace function private.assert_accounting_period_open(
  p_tenant_id uuid,
  p_org_id uuid,
  p_entry_date date
) returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_blocked boolean := false;
begin
  if to_regclass('public.accounting_periods') is null then
    return;
  end if;

  execute $sql$
    select exists(
      select 1
      from public.accounting_periods
      where tenant_id = $1
        and org_id = $2
        and $3 between period_start and period_end
        and status <> 'open'
    )
  $sql$ into v_blocked using p_tenant_id, p_org_id, p_entry_date;

  if v_blocked then
    raise exception 'Accounting period is not open for %', p_entry_date;
  end if;
end;
$$;

create or replace function private.upsert_accounting_settings(
  p_tenant_id uuid,
  p_org_id uuid,
  p_base_currency text,
  p_fiscal_month smallint,
  p_fiscal_day smallint,
  p_default_ar_account_id uuid,
  p_default_ap_account_id uuid
) returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_currency text := upper(btrim(p_base_currency));
begin
  perform private.require_accounting_permission(p_tenant_id, p_org_id, 'accounting.admin');

  if v_currency !~ '^[A-Z]{3}$' then raise exception 'Base currency must be a 3-letter uppercase code'; end if;
  if p_fiscal_month not between 1 and 12 then raise exception 'Fiscal month must be 1-12'; end if;
  if p_fiscal_day not between 1 and 31 then raise exception 'Fiscal day must be 1-31'; end if;

  if p_default_ar_account_id is not null and not exists (
    select 1 from public.chart_of_accounts
    where id = p_default_ar_account_id and tenant_id = p_tenant_id and org_id = p_org_id and active
  ) then raise exception 'Default AR account must be an active account in the same scope'; end if;

  if p_default_ap_account_id is not null and not exists (
    select 1 from public.chart_of_accounts
    where id = p_default_ap_account_id and tenant_id = p_tenant_id and org_id = p_org_id and active
  ) then raise exception 'Default AP account must be an active account in the same scope'; end if;

  select to_jsonb(s) into v_before
  from public.accounting_settings s
  where tenant_id = p_tenant_id and org_id = p_org_id;

  insert into public.accounting_settings(
    tenant_id, org_id, base_currency, fiscal_year_start_month,
    fiscal_year_start_day, default_ar_account_id, default_ap_account_id
  ) values (
    p_tenant_id, p_org_id, v_currency, p_fiscal_month,
    p_fiscal_day, p_default_ar_account_id, p_default_ap_account_id
  )
  on conflict (tenant_id, org_id) do update set
    base_currency = excluded.base_currency,
    fiscal_year_start_month = excluded.fiscal_year_start_month,
    fiscal_year_start_day = excluded.fiscal_year_start_day,
    default_ar_account_id = excluded.default_ar_account_id,
    default_ap_account_id = excluded.default_ap_account_id,
    updated_at = now();

  select to_jsonb(s) into v_after
  from public.accounting_settings s
  where tenant_id = p_tenant_id and org_id = p_org_id;

  perform private.accounting_audit(p_tenant_id, p_org_id, 'accounting.settings.upsert', 'accounting_settings', p_org_id::text, v_before, v_after);
end;
$$;

create or replace function private.create_accounting_account(
  p_tenant_id uuid,
  p_org_id uuid,
  p_account_number text,
  p_name text,
  p_account_type text,
  p_normal_balance text,
  p_system_account boolean
) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_id uuid;
  v_after jsonb;
begin
  perform private.require_accounting_permission(
    p_tenant_id, p_org_id,
    case when p_system_account then 'accounting.admin' else 'accounting.write' end
  );

  if btrim(p_account_number) = '' then raise exception 'Account number required'; end if;
  if btrim(p_name) = '' then raise exception 'Account name required'; end if;

  insert into public.chart_of_accounts(
    tenant_id, org_id, account_number, name, account_type, normal_balance, system_account
  ) values (
    p_tenant_id, p_org_id, btrim(p_account_number), btrim(p_name), p_account_type, p_normal_balance, p_system_account
  ) returning id into v_id;

  select to_jsonb(a) into v_after from public.chart_of_accounts a where id = v_id;
  perform private.accounting_audit(p_tenant_id, p_org_id, 'accounting.account.create', 'chart_of_accounts', v_id::text, null, v_after);
  return v_id;
end;
$$;

create or replace function private.update_accounting_account(
  p_tenant_id uuid,
  p_org_id uuid,
  p_account_id uuid,
  p_account_number text,
  p_name text,
  p_account_type text,
  p_normal_balance text,
  p_active boolean,
  p_system_account boolean
) returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_existing_system boolean;
begin
  select to_jsonb(a), a.system_account into v_before, v_existing_system
  from public.chart_of_accounts a
  where id = p_account_id and tenant_id = p_tenant_id and org_id = p_org_id
  for update;

  if v_before is null then raise exception 'Account not found in scope'; end if;

  perform private.require_accounting_permission(
    p_tenant_id, p_org_id,
    case when v_existing_system or p_system_account then 'accounting.admin' else 'accounting.write' end
  );

  update public.chart_of_accounts set
    account_number = btrim(p_account_number),
    name = btrim(p_name),
    account_type = p_account_type,
    normal_balance = p_normal_balance,
    active = p_active,
    system_account = p_system_account,
    updated_at = now()
  where id = p_account_id and tenant_id = p_tenant_id and org_id = p_org_id;

  select to_jsonb(a) into v_after from public.chart_of_accounts a where id = p_account_id;
  perform private.accounting_audit(p_tenant_id, p_org_id, 'accounting.account.update', 'chart_of_accounts', p_account_id::text, v_before, v_after);
end;
$$;

create or replace function private.create_accounting_journal_draft(
  p_tenant_id uuid,
  p_org_id uuid,
  p_entry_number text,
  p_entry_date date,
  p_memo text,
  p_source_type text,
  p_source_id text
) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_id uuid;
  v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id, p_org_id, 'accounting.write');
  if btrim(p_entry_number) = '' then raise exception 'Entry number required'; end if;

  insert into public.journal_entries(
    tenant_id, org_id, entry_number, entry_date, memo, source_type, source_id, created_by
  ) values (
    p_tenant_id, p_org_id, btrim(p_entry_number), p_entry_date, nullif(btrim(coalesce(p_memo,'')),''),
    nullif(btrim(coalesce(p_source_type,'')),''), nullif(btrim(coalesce(p_source_id,'')),''), auth.uid()
  ) returning id into v_id;

  select to_jsonb(j) into v_after from public.journal_entries j where id = v_id;
  perform private.accounting_audit(p_tenant_id, p_org_id, 'accounting.journal.create_draft', 'journal_entries', v_id::text, null, v_after);
  return v_id;
end;
$$;

create or replace function private.replace_accounting_journal_lines(
  p_tenant_id uuid,
  p_org_id uuid,
  p_journal_id uuid,
  p_lines jsonb
) returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_status text;
  v_count integer;
  v_before jsonb;
  v_after jsonb;
  v_row jsonb;
  v_line_no integer := 0;
  v_account_id uuid;
  v_debit numeric(20,4);
  v_credit numeric(20,4);
begin
  perform private.require_accounting_permission(p_tenant_id, p_org_id, 'accounting.write');

  select status into v_status
  from public.journal_entries
  where id = p_journal_id and tenant_id = p_tenant_id and org_id = p_org_id
  for update;

  if v_status is null then raise exception 'Journal not found in scope'; end if;
  if v_status <> 'draft' then raise exception 'Only draft journals can change lines'; end if;
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'Lines must be a JSON array'; end if;

  v_count := jsonb_array_length(p_lines);
  if v_count < 2 then raise exception 'At least two journal lines are required'; end if;

  select coalesce(jsonb_agg(to_jsonb(l) order by l.line_number), '[]'::jsonb)
    into v_before
  from public.journal_lines l
  where l.journal_entry_id = p_journal_id and l.tenant_id = p_tenant_id and l.org_id = p_org_id;

  delete from public.journal_lines
  where journal_entry_id = p_journal_id and tenant_id = p_tenant_id and org_id = p_org_id;

  for v_row in select value from jsonb_array_elements(p_lines)
  loop
    v_line_no := v_line_no + 1;
    v_account_id := (v_row->>'account_id')::uuid;
    v_debit := coalesce((v_row->>'debit')::numeric, 0);
    v_credit := coalesce((v_row->>'credit')::numeric, 0);

    if not exists (
      select 1 from public.chart_of_accounts
      where id = v_account_id and tenant_id = p_tenant_id and org_id = p_org_id and active
    ) then raise exception 'Journal account % is not active in scope', v_account_id; end if;

    insert into public.journal_lines(
      tenant_id, org_id, journal_entry_id, line_number, account_id,
      description, debit, credit, dimensions
    ) values (
      p_tenant_id, p_org_id, p_journal_id, v_line_no, v_account_id,
      nullif(btrim(coalesce(v_row->>'description','')),''), v_debit, v_credit,
      case when jsonb_typeof(v_row->'dimensions') = 'object' then v_row->'dimensions' else '{}'::jsonb end
    );
  end loop;

  select coalesce(jsonb_agg(to_jsonb(l) order by l.line_number), '[]'::jsonb)
    into v_after
  from public.journal_lines l
  where l.journal_entry_id = p_journal_id and l.tenant_id = p_tenant_id and l.org_id = p_org_id;

  perform private.accounting_audit(p_tenant_id, p_org_id, 'accounting.journal.replace_lines', 'journal_entries', p_journal_id::text, v_before, v_after);
end;
$$;

create or replace function private.post_accounting_journal(
  p_tenant_id uuid,
  p_org_id uuid,
  p_journal_id uuid
) returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_journal public.journal_entries%rowtype;
  v_count integer;
  v_debit numeric(30,4);
  v_credit numeric(30,4);
  v_before jsonb;
  v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id, p_org_id, 'accounting.post');

  select * into v_journal
  from public.journal_entries
  where id = p_journal_id and tenant_id = p_tenant_id and org_id = p_org_id
  for update;

  if v_journal.id is null then raise exception 'Journal not found in scope'; end if;
  if v_journal.status <> 'draft' then raise exception 'Only draft journals can be posted'; end if;

  select count(*), coalesce(sum(debit),0), coalesce(sum(credit),0)
    into v_count, v_debit, v_credit
  from public.journal_lines
  where journal_entry_id = p_journal_id and tenant_id = p_tenant_id and org_id = p_org_id;

  if v_count < 2 then raise exception 'At least two journal lines are required'; end if;
  if v_debit <= 0 or v_credit <= 0 or v_debit <> v_credit then
    raise exception 'Journal is not balanced: debit %, credit %', v_debit, v_credit;
  end if;

  perform private.assert_accounting_period_open(p_tenant_id, p_org_id, v_journal.entry_date);
  v_before := to_jsonb(v_journal);

  update public.journal_entries set
    status = 'posted',
    posted_by = auth.uid(),
    posted_at = now(),
    updated_at = now()
  where id = p_journal_id;

  select to_jsonb(j) into v_after from public.journal_entries j where id = p_journal_id;
  perform private.accounting_audit(p_tenant_id, p_org_id, 'accounting.journal.post', 'journal_entries', p_journal_id::text, v_before, v_after);
end;
$$;

create or replace function private.reverse_accounting_journal(
  p_tenant_id uuid,
  p_org_id uuid,
  p_journal_id uuid,
  p_reversal_entry_number text,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_original public.journal_entries%rowtype;
  v_reversal_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  perform private.require_accounting_permission(p_tenant_id, p_org_id, 'accounting.post');
  if btrim(p_reason) = '' then raise exception 'Reversal reason required'; end if;
  if btrim(p_reversal_entry_number) = '' then raise exception 'Reversal entry number required'; end if;

  select * into v_original
  from public.journal_entries
  where id = p_journal_id and tenant_id = p_tenant_id and org_id = p_org_id
  for update;

  if v_original.id is null then raise exception 'Journal not found in scope'; end if;
  if v_original.status <> 'posted' then raise exception 'Only posted journals can be reversed'; end if;
  if v_original.reversed_by_journal_entry_id is not null then raise exception 'Journal is already reversed'; end if;

  perform private.assert_accounting_period_open(p_tenant_id, p_org_id, current_date);

  insert into public.journal_entries(
    tenant_id, org_id, entry_number, entry_date, memo, status,
    source_type, source_id, created_by, reverses_journal_entry_id
  ) values (
    p_tenant_id, p_org_id, btrim(p_reversal_entry_number), current_date,
    'Reversal: ' || btrim(p_reason), 'draft', 'journal_reversal', p_journal_id::text,
    auth.uid(), p_journal_id
  ) returning id into v_reversal_id;

  insert into public.journal_lines(
    tenant_id, org_id, journal_entry_id, line_number, account_id,
    description, debit, credit, dimensions
  )
  select tenant_id, org_id, v_reversal_id, line_number, account_id,
         coalesce(description, 'Reversal'), credit, debit, dimensions
  from public.journal_lines
  where journal_entry_id = p_journal_id and tenant_id = p_tenant_id and org_id = p_org_id
  order by line_number;

  perform private.post_accounting_journal(p_tenant_id, p_org_id, v_reversal_id);

  v_before := to_jsonb(v_original);
  perform set_config('atlas.accounting_governed_mutation', '1', true);
  update public.journal_entries set
    status = 'reversed',
    reversed_by_journal_entry_id = v_reversal_id,
    updated_at = now()
  where id = p_journal_id;
  perform set_config('atlas.accounting_governed_mutation', '', true);

  select to_jsonb(j) into v_after from public.journal_entries j where id = p_journal_id;
  perform private.accounting_audit(p_tenant_id, p_org_id, 'accounting.journal.reverse', 'journal_entries', p_journal_id::text, v_before, v_after);
  return v_reversal_id;
end;
$$;

create or replace function private.enforce_journal_entry_immutability()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if tg_op = 'DELETE' and old.status in ('posted','reversed') then
    raise exception 'Posted or reversed journals cannot be deleted';
  end if;

  if tg_op = 'UPDATE' and old.status in ('posted','reversed') then
    if coalesce(current_setting('atlas.accounting_governed_mutation', true),'') <> '1' then
      raise exception 'Posted or reversed journals are immutable';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.enforce_journal_line_immutability()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_journal_id uuid;
  v_status text;
begin
  v_journal_id := case when tg_op = 'DELETE' then old.journal_entry_id else new.journal_entry_id end;
  select status into v_status from public.journal_entries where id = v_journal_id;
  if v_status is null then raise exception 'Parent journal not found'; end if;
  if v_status <> 'draft' then raise exception 'Journal lines are immutable after posting'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger journal_entries_immutable_guard
before update or delete on public.journal_entries
for each row execute function private.enforce_journal_entry_immutability();

create trigger journal_lines_immutable_guard
before insert or update or delete on public.journal_lines
for each row execute function private.enforce_journal_line_immutability();

create or replace function public.upsert_accounting_settings(
  p_tenant_id uuid,
  p_org_id uuid,
  p_base_currency text,
  p_fiscal_month smallint,
  p_fiscal_day smallint,
  p_default_ar_account_id uuid default null,
  p_default_ap_account_id uuid default null
) returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$ select private.upsert_accounting_settings($1,$2,$3,$4,$5,$6,$7); $$;

create or replace function public.create_accounting_account(
  p_tenant_id uuid,
  p_org_id uuid,
  p_account_number text,
  p_name text,
  p_account_type text,
  p_normal_balance text,
  p_system_account boolean default false
) returns uuid
language sql
security invoker
set search_path = public, private, pg_temp
as $$ select private.create_accounting_account($1,$2,$3,$4,$5,$6,$7); $$;

create or replace function public.update_accounting_account(
  p_tenant_id uuid,
  p_org_id uuid,
  p_account_id uuid,
  p_account_number text,
  p_name text,
  p_account_type text,
  p_normal_balance text,
  p_active boolean,
  p_system_account boolean
) returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$ select private.update_accounting_account($1,$2,$3,$4,$5,$6,$7,$8,$9); $$;

create or replace function public.create_accounting_journal_draft(
  p_tenant_id uuid,
  p_org_id uuid,
  p_entry_number text,
  p_entry_date date,
  p_memo text default null,
  p_source_type text default null,
  p_source_id text default null
) returns uuid
language sql
security invoker
set search_path = public, private, pg_temp
as $$ select private.create_accounting_journal_draft($1,$2,$3,$4,$5,$6,$7); $$;

create or replace function public.replace_accounting_journal_lines(
  p_tenant_id uuid,
  p_org_id uuid,
  p_journal_id uuid,
  p_lines jsonb
) returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$ select private.replace_accounting_journal_lines($1,$2,$3,$4); $$;

create or replace function public.post_accounting_journal(
  p_tenant_id uuid,
  p_org_id uuid,
  p_journal_id uuid
) returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$ select private.post_accounting_journal($1,$2,$3); $$;

create or replace function public.reverse_accounting_journal(
  p_tenant_id uuid,
  p_org_id uuid,
  p_journal_id uuid,
  p_reversal_entry_number text,
  p_reason text
) returns uuid
language sql
security invoker
set search_path = public, private, pg_temp
as $$ select private.reverse_accounting_journal($1,$2,$3,$4,$5); $$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.upsert_accounting_settings(uuid,uuid,text,smallint,smallint,uuid,uuid) to authenticated;
grant execute on function private.create_accounting_account(uuid,uuid,text,text,text,text,boolean) to authenticated;
grant execute on function private.update_accounting_account(uuid,uuid,uuid,text,text,text,text,boolean,boolean) to authenticated;
grant execute on function private.create_accounting_journal_draft(uuid,uuid,text,date,text,text,text) to authenticated;
grant execute on function private.replace_accounting_journal_lines(uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function private.post_accounting_journal(uuid,uuid,uuid) to authenticated;
grant execute on function private.reverse_accounting_journal(uuid,uuid,uuid,text,text) to authenticated;

revoke all on function public.upsert_accounting_settings(uuid,uuid,text,smallint,smallint,uuid,uuid) from public, anon;
revoke all on function public.create_accounting_account(uuid,uuid,text,text,text,text,boolean) from public, anon;
revoke all on function public.update_accounting_account(uuid,uuid,uuid,text,text,text,text,boolean,boolean) from public, anon;
revoke all on function public.create_accounting_journal_draft(uuid,uuid,text,date,text,text,text) from public, anon;
revoke all on function public.replace_accounting_journal_lines(uuid,uuid,uuid,jsonb) from public, anon;
revoke all on function public.post_accounting_journal(uuid,uuid,uuid) from public, anon;
revoke all on function public.reverse_accounting_journal(uuid,uuid,uuid,text,text) from public, anon;

grant execute on function public.upsert_accounting_settings(uuid,uuid,text,smallint,smallint,uuid,uuid) to authenticated;
grant execute on function public.create_accounting_account(uuid,uuid,text,text,text,text,boolean) to authenticated;
grant execute on function public.update_accounting_account(uuid,uuid,uuid,text,text,text,text,boolean,boolean) to authenticated;
grant execute on function public.create_accounting_journal_draft(uuid,uuid,text,date,text,text,text) to authenticated;
grant execute on function public.replace_accounting_journal_lines(uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function public.post_accounting_journal(uuid,uuid,uuid) to authenticated;
grant execute on function public.reverse_accounting_journal(uuid,uuid,uuid,text,text) to authenticated;

commit;