begin;

drop policy if exists people_time_entries_write on public.people_time_entries;

create or replace function public.create_people_time_entry(
  organization_uuid uuid,
  employee_uuid uuid,
  work_day date,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  break_minutes_value integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  entry_id uuid;
  self_service boolean;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from public.employees e
    where e.org_id = organization_uuid
      and e.id = employee_uuid
      and e.user_id = actor
  ) into self_service;

  if not public.has_identity_permission(organization_uuid, 'hr.write') and not self_service then
    raise exception 'hr.write permission or employee self-service ownership is required';
  end if;

  if work_day is null then
    raise exception 'Work date is required';
  end if;
  if clock_in_at is null or clock_out_at is null then
    raise exception 'Clock-in and clock-out are required';
  end if;
  if clock_out_at <= clock_in_at then
    raise exception 'Clock-out must be after clock-in';
  end if;
  if break_minutes_value is null or break_minutes_value < 0 then
    raise exception 'Break minutes must be non-negative';
  end if;
  if break_minutes_value > extract(epoch from (clock_out_at - clock_in_at)) / 60 then
    raise exception 'Break minutes cannot exceed the worked interval';
  end if;

  insert into public.people_time_entries (
    org_id,
    employee_id,
    work_date,
    clock_in,
    clock_out,
    break_minutes,
    status
  ) values (
    organization_uuid,
    employee_uuid,
    work_day,
    clock_in_at,
    clock_out_at,
    break_minutes_value,
    'draft'
  ) returning id into entry_id;

  insert into public.audit_logs (
    org_id,
    user_id,
    action,
    table_name,
    record_id,
    new_data
  ) values (
    organization_uuid,
    actor,
    'people.time.create',
    'people_time_entries',
    entry_id::text,
    jsonb_build_object(
      'employee_id', employee_uuid,
      'work_date', work_day,
      'status', 'draft'
    )
  );

  return entry_id;
end;
$$;

create or replace function public.submit_people_time_entry(
  organization_uuid uuid,
  time_entry_uuid uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  current_row public.people_time_entries%rowtype;
  self_service boolean;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select * into current_row
  from public.people_time_entries
  where org_id = organization_uuid and id = time_entry_uuid
  for update;

  if not found then
    raise exception 'Time entry not found';
  end if;

  select exists (
    select 1
    from public.employees e
    where e.org_id = organization_uuid
      and e.id = current_row.employee_id
      and e.user_id = actor
  ) into self_service;

  if not public.has_identity_permission(organization_uuid, 'hr.write') and not self_service then
    raise exception 'hr.write permission or employee self-service ownership is required';
  end if;

  if current_row.status <> 'draft' then
    raise exception 'Only draft time entries can be submitted';
  end if;
  if current_row.clock_in is null or current_row.clock_out is null then
    raise exception 'Clock-in and clock-out are required before submission';
  end if;
  if current_row.clock_out <= current_row.clock_in then
    raise exception 'Clock-out must be after clock-in';
  end if;
  if current_row.break_minutes > extract(epoch from (current_row.clock_out - current_row.clock_in)) / 60 then
    raise exception 'Break minutes cannot exceed the worked interval';
  end if;

  update public.people_time_entries
  set status = 'submitted', approved_by = null, approved_at = null, updated_at = now()
  where org_id = organization_uuid and id = time_entry_uuid;

  insert into public.audit_logs (
    org_id, user_id, action, table_name, record_id, old_data, new_data
  ) values (
    organization_uuid,
    actor,
    'people.time.submit',
    'people_time_entries',
    time_entry_uuid::text,
    jsonb_build_object('status', current_row.status),
    jsonb_build_object('status', 'submitted')
  );

  return time_entry_uuid;
end;
$$;

create or replace function public.approve_people_time_entry(
  organization_uuid uuid,
  time_entry_uuid uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  current_row public.people_time_entries%rowtype;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_identity_permission(organization_uuid, 'hr.write') then
    raise exception 'hr.write permission is required';
  end if;

  select * into current_row
  from public.people_time_entries
  where org_id = organization_uuid and id = time_entry_uuid
  for update;

  if not found then
    raise exception 'Time entry not found';
  end if;
  if current_row.status <> 'submitted' then
    raise exception 'Only submitted time entries can be approved';
  end if;

  update public.people_time_entries
  set status = 'approved', approved_by = actor, approved_at = now(), updated_at = now()
  where org_id = organization_uuid and id = time_entry_uuid;

  insert into public.audit_logs (
    org_id, user_id, action, table_name, record_id, old_data, new_data
  ) values (
    organization_uuid,
    actor,
    'people.time.approve',
    'people_time_entries',
    time_entry_uuid::text,
    jsonb_build_object('status', current_row.status),
    jsonb_build_object('status', 'approved', 'approved_by', actor)
  );

  return time_entry_uuid;
end;
$$;

create or replace function public.reject_people_time_entry(
  organization_uuid uuid,
  time_entry_uuid uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  current_row public.people_time_entries%rowtype;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_identity_permission(organization_uuid, 'hr.write') then
    raise exception 'hr.write permission is required';
  end if;

  select * into current_row
  from public.people_time_entries
  where org_id = organization_uuid and id = time_entry_uuid
  for update;

  if not found then
    raise exception 'Time entry not found';
  end if;
  if current_row.status <> 'submitted' then
    raise exception 'Only submitted time entries can be rejected';
  end if;

  update public.people_time_entries
  set status = 'rejected', approved_by = null, approved_at = null, updated_at = now()
  where org_id = organization_uuid and id = time_entry_uuid;

  insert into public.audit_logs (
    org_id, user_id, action, table_name, record_id, old_data, new_data
  ) values (
    organization_uuid,
    actor,
    'people.time.reject',
    'people_time_entries',
    time_entry_uuid::text,
    jsonb_build_object('status', current_row.status),
    jsonb_build_object('status', 'rejected')
  );

  return time_entry_uuid;
end;
$$;

revoke all on function public.create_people_time_entry(uuid, uuid, date, timestamptz, timestamptz, integer) from public, anon;
revoke all on function public.submit_people_time_entry(uuid, uuid) from public, anon;
revoke all on function public.approve_people_time_entry(uuid, uuid) from public, anon;
revoke all on function public.reject_people_time_entry(uuid, uuid) from public, anon;

grant execute on function public.create_people_time_entry(uuid, uuid, date, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.submit_people_time_entry(uuid, uuid) to authenticated;
grant execute on function public.approve_people_time_entry(uuid, uuid) to authenticated;
grant execute on function public.reject_people_time_entry(uuid, uuid) to authenticated;

commit;
