begin;

create or replace function public.guard_people_payroll_run_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.org_id is distinct from old.org_id then
    raise exception 'Payroll run organization scope cannot change';
  end if;

  if old.status = 'locked' then
    raise exception 'Locked payroll runs are immutable';
  end if;

  if old.status = 'void' then
    raise exception 'Void payroll runs are immutable';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'draft' and new.status not in ('calculated', 'void') then
      raise exception 'Invalid payroll transition from draft to %', new.status;
    elsif old.status = 'calculated' and new.status not in ('approved', 'void') then
      raise exception 'Invalid payroll transition from calculated to %', new.status;
    elsif old.status = 'approved' and new.status not in ('locked', 'void') then
      raise exception 'Invalid payroll transition from approved to %', new.status;
    end if;
  end if;

  if new.status = 'approved' and new.status is distinct from old.status then
    if not public.has_identity_permission(old.org_id, 'payroll.approve') then
      raise exception 'payroll.approve permission is required';
    end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
  elsif new.status = 'locked' and new.status is distinct from old.status then
    if not public.has_identity_permission(old.org_id, 'payroll.approve') then
      raise exception 'payroll.approve permission is required';
    end if;
    if old.approved_by is null or old.approved_at is null then
      raise exception 'Payroll approval evidence is required before locking';
    end if;
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
  elsif new.status = 'void' and new.status is distinct from old.status then
    if not public.has_identity_permission(old.org_id, 'payroll.approve') then
      raise exception 'payroll.approve permission is required';
    end if;
  elsif (
    new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
  ) then
    raise exception 'Payroll approval evidence cannot be modified outside the approval transition';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_people_payroll_run_transition() from public, anon, authenticated;

commit;
