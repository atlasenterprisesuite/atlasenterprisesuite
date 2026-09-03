alter table public.journal_entries
  add column if not exists reverses_journal_entry_id uuid
  references public.journal_entries(id) on delete restrict;

create unique index if not exists journal_entries_one_reversal_per_entry
  on public.journal_entries(reverses_journal_entry_id)
  where reverses_journal_entry_id is not null;

create or replace function public.prevent_posted_journal_entry_mutation()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if old.status = 'posted' then
    raise exception 'Posted journal entries are immutable; create a reversal instead';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists atlas_guard_posted_journal_entry on public.journal_entries;
create trigger atlas_guard_posted_journal_entry
before update or delete on public.journal_entries
for each row execute function public.prevent_posted_journal_entry_mutation();

create or replace function public.prevent_posted_journal_line_mutation()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  parent_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.journal_entry_id is not null then
    select status into parent_status
      from public.journal_entries
     where id = old.journal_entry_id;
    if parent_status = 'posted' then
      raise exception 'Posted journal lines are immutable; create a reversal instead';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.journal_entry_id is not null then
    select status into parent_status
      from public.journal_entries
     where id = new.journal_entry_id;
    if parent_status = 'posted' then
      raise exception 'Cannot add or move lines into a posted journal entry';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists atlas_guard_posted_journal_line on public.journal_lines;
create trigger atlas_guard_posted_journal_line
before insert or update or delete on public.journal_lines
for each row execute function public.prevent_posted_journal_line_mutation();

create or replace function public.reverse_posted_journal_entry(
  organization_uuid uuid,
  journal_uuid uuid,
  reversal_code text,
  reversal_on date,
  reversal_reason text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  reversal_uuid uuid;
  original_entry_number text;
  original_status text;
  inserted_lines integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_write_accounting_data(organization_uuid) then
    raise exception 'Accounting role required';
  end if;

  if nullif(btrim(coalesce(reversal_code, '')), '') is null then
    raise exception 'Reversal entry number is required';
  end if;

  if nullif(btrim(coalesce(reversal_reason, '')), '') is null then
    raise exception 'Reversal reason is required';
  end if;

  select entry_number, status
    into original_entry_number, original_status
    from public.journal_entries
   where id = journal_uuid
     and org_id = organization_uuid
   for update;

  if not found then
    raise exception 'Journal entry not found in active organization';
  end if;

  if original_status is distinct from 'posted' then
    raise exception 'Only posted journal entries can be reversed';
  end if;

  if not public.validate_journal_entry(journal_uuid) then
    raise exception 'Original journal entry is not balanced';
  end if;

  if exists (
    select 1
      from public.journal_entries
     where org_id = organization_uuid
       and reverses_journal_entry_id = journal_uuid
  ) then
    raise exception 'Journal entry has already been reversed';
  end if;

  insert into public.journal_entries(
    org_id,
    entry_number,
    entry_date,
    memo,
    status,
    created_by,
    reverses_journal_entry_id
  )
  values (
    organization_uuid,
    reversal_code,
    coalesce(reversal_on, current_date),
    'Reversal of ' || original_entry_number || ': ' || btrim(reversal_reason),
    'draft',
    auth.uid(),
    journal_uuid
  )
  returning id into reversal_uuid;

  insert into public.journal_lines(
    org_id,
    journal_entry_id,
    account_id,
    debit,
    credit
  )
  select
    organization_uuid,
    reversal_uuid,
    account_id,
    coalesce(credit, 0),
    coalesce(debit, 0)
  from public.journal_lines
  where journal_entry_id = journal_uuid
    and org_id = organization_uuid;

  get diagnostics inserted_lines = row_count;
  if inserted_lines < 2 then
    raise exception 'Original journal entry does not contain enough lines to reverse';
  end if;

  update public.journal_entries
     set status = 'posted'
   where id = reversal_uuid;

  return reversal_uuid;
end;
$$;

revoke all on function public.reverse_posted_journal_entry(uuid, uuid, text, date, text) from public;
revoke all on function public.reverse_posted_journal_entry(uuid, uuid, text, date, text) from anon;
grant execute on function public.reverse_posted_journal_entry(uuid, uuid, text, date, text) to authenticated;
grant execute on function public.reverse_posted_journal_entry(uuid, uuid, text, date, text) to service_role;
