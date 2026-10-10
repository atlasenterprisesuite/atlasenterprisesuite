-- Harden ATLAS Accounting period close so a period cannot be marked complete by permission alone.
-- The close remains SECURITY INVOKER and therefore continues to respect RLS/auth context.

create or replace function public.close_accounting_period(
  organization_uuid uuid,
  period_uuid uuid
)
returns uuid
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  target_org uuid;
  target_start date;
  target_end date;
  target_status text;
  total_tasks integer := 0;
  incomplete_tasks integer := 0;
  unreconciled_sessions integer := 0;
  posted_debits numeric := 0;
  posted_credits numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if organization_uuid is null or period_uuid is null then
    raise exception 'Organization and period are required';
  end if;
  if not public.has_identity_permission(organization_uuid, 'accounting.close') then
    raise exception 'Accounting close permission required';
  end if;

  select org_id, period_start, period_end, status
    into target_org, target_start, target_end, target_status
    from public.accounting_periods
   where id = period_uuid
   for update;

  if target_org is null then
    raise exception 'Accounting period not found';
  end if;
  if target_org <> organization_uuid then
    raise exception 'Accounting period organization mismatch';
  end if;
  if target_status in ('closed', 'locked') then
    raise exception 'Accounting period is already closed';
  end if;

  select count(*), count(*) filter (where lower(status) not in ('completed', 'complete', 'done', 'approved'))
    into total_tasks, incomplete_tasks
    from public.accounting_close_tasks
   where org_id = organization_uuid
     and period_id = period_uuid;

  if total_tasks = 0 then
    raise exception 'Accounting close checklist is required before period lock';
  end if;
  if incomplete_tasks > 0 then
    raise exception 'Accounting close checklist contains incomplete tasks';
  end if;

  select count(*)
    into unreconciled_sessions
    from public.accounting_reconciliation_sessions
   where org_id = organization_uuid
     and period_end between target_start and target_end
     and status not in ('reconciled', 'locked');

  if unreconciled_sessions > 0 then
    raise exception 'All reconciliation sessions in the period must be closed';
  end if;

  select
    coalesce(sum(coalesce(l.debit, 0)), 0),
    coalesce(sum(coalesce(l.credit, 0)), 0)
    into posted_debits, posted_credits
    from public.journal_entries j
    join public.journal_lines l
      on l.journal_entry_id = j.id
     and l.org_id = j.org_id
   where j.org_id = organization_uuid
     and j.status = 'posted'
     and j.entry_date between target_start and target_end;

  if round(posted_debits, 2) <> round(posted_credits, 2) then
    raise exception 'Posted journal debits and credits must balance before period lock';
  end if;

  update public.accounting_periods
     set status = 'locked',
         close_readiness = 100,
         closed_by = auth.uid(),
         closed_at = now(),
         updated_at = now()
   where id = period_uuid
     and org_id = organization_uuid;

  return period_uuid;
end;
$function$;
