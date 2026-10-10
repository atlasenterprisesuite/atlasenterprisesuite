create or replace function public.guard_accounting_budget_change()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
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
before insert or update or delete on public.accounting_budgets
for each row execute function public.guard_accounting_budget_change();