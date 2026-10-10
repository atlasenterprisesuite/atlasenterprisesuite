create or replace function public.guard_accounting_budget_change()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  line_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Only draft budget versions can be deleted';
    end if;
    return old;
  end if;

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
  if old.status = 'archived' then
    raise exception 'Archived budget versions are immutable';
  end if;

  if old.status = 'approved' then
    if new.status not in ('approved','locked','archived') then
      raise exception 'Approved budgets can only be locked or archived; create a new version for revisions';
    end if;
    if new.status = 'approved' then
      if (new.name,new.fiscal_year,new.version,new.scenario,new.base_currency,new.entity_id)
         is distinct from
         (old.name,old.fiscal_year,old.version,old.scenario,old.base_currency,old.entity_id) then
        raise exception 'Approved budget versions are immutable; create a new version for revisions';
      end if;
    end if;
  end if;

  if old.status is distinct from new.status then
    if not public.has_identity_permission(new.org_id,'accounting.admin') then
      raise exception 'Accounting admin permission required for budget status changes';
    end if;

    if new.status = 'approved' then
      if old.status <> 'draft' then raise exception 'Only draft budgets can be approved'; end if;
      select count(*) into line_count from public.accounting_budget_lines where budget_id=old.id and org_id=old.org_id;
      if line_count = 0 then raise exception 'Budget requires at least one line before approval'; end if;
      new.approved_by := auth.uid();
      new.approved_at := now();
    elsif new.status = 'locked' then
      if old.status <> 'approved' then raise exception 'Only approved budgets can be locked'; end if;
      new.approved_by := coalesce(old.approved_by,auth.uid());
      new.approved_at := coalesce(old.approved_at,now());
    elsif new.status = 'archived' then
      new.approved_by := old.approved_by;
      new.approved_at := old.approved_at;
    elsif new.status = 'draft' then
      if old.status <> 'draft' then raise exception 'Approved budgets cannot return to draft; create a new version'; end if;
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
before insert or update or delete on public.accounting_budgets
for each row execute function public.guard_accounting_budget_change();