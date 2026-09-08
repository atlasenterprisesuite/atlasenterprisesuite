begin;

alter table public.people_applications
  add column if not exists decision_reason text;

drop policy if exists people_applications_write on public.people_applications;
drop policy if exists people_applications_insert on public.people_applications;

create policy people_applications_insert on public.people_applications
for insert to authenticated
with check (public.has_identity_permission(org_id, 'hr.write'));

create or replace function public.advance_people_application_stage(
  organization_uuid uuid,
  application_uuid uuid,
  next_stage_value text,
  decision_reason_value text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  current_row public.people_applications%rowtype;
  normalized_reason text := nullif(btrim(coalesce(decision_reason_value, '')), '');
  transition_allowed boolean := false;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_identity_permission(organization_uuid, 'hr.write') then
    raise exception 'hr.write permission is required';
  end if;

  select * into current_row
  from public.people_applications
  where org_id = organization_uuid and id = application_uuid
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if current_row.stage in ('hired', 'rejected', 'withdrawn') then
    raise exception 'Terminal application stages cannot be reopened silently';
  end if;

  transition_allowed := case current_row.stage
    when 'applied' then next_stage_value in ('screening', 'rejected', 'withdrawn')
    when 'screening' then next_stage_value in ('assessment', 'interview', 'rejected', 'withdrawn')
    when 'assessment' then next_stage_value in ('interview', 'rejected', 'withdrawn')
    when 'interview' then next_stage_value in ('offer', 'rejected', 'withdrawn')
    when 'offer' then next_stage_value in ('hired', 'rejected', 'withdrawn')
    else false
  end;

  if not transition_allowed then
    raise exception 'Unsupported application transition: % -> %', current_row.stage, next_stage_value;
  end if;

  if next_stage_value in ('rejected', 'withdrawn') and normalized_reason is null then
    raise exception 'A decision reason is required for rejected or withdrawn applications';
  end if;

  update public.people_applications
  set stage = next_stage_value,
      decision_reason = case
        when next_stage_value in ('rejected', 'withdrawn') then normalized_reason
        else null
      end,
      updated_at = now()
  where org_id = organization_uuid and id = application_uuid;

  insert into public.audit_logs (
    org_id, user_id, action, table_name, record_id, old_data, new_data
  ) values (
    organization_uuid,
    actor,
    'people.recruiting.stage.advance',
    'people_applications',
    application_uuid::text,
    jsonb_build_object('stage', current_row.stage, 'decision_reason', current_row.decision_reason),
    jsonb_build_object('stage', next_stage_value, 'decision_reason', normalized_reason)
  );

  return application_uuid;
end;
$$;

create or replace function public.record_people_assessment_result(
  organization_uuid uuid,
  application_uuid uuid,
  assessment_type_value text,
  earned_value numeric,
  possible_value numeric,
  passing_percent_value numeric default 70,
  result_value jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  assessment_id uuid;
  percent_score numeric(7,3);
  passed_value boolean;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_identity_permission(organization_uuid, 'hr.write') then
    raise exception 'hr.write permission is required';
  end if;
  if nullif(btrim(coalesce(assessment_type_value, '')), '') is null then
    raise exception 'Assessment type is required';
  end if;
  if possible_value is null or possible_value <= 0 then
    raise exception 'Possible score must be greater than zero';
  end if;
  if earned_value is null or earned_value < 0 or earned_value > possible_value then
    raise exception 'Earned score must be between zero and possible score';
  end if;
  if passing_percent_value is null or passing_percent_value < 0 or passing_percent_value > 100 then
    raise exception 'Passing percent must be between zero and 100';
  end if;
  if jsonb_typeof(coalesce(result_value, '{}'::jsonb)) <> 'object' then
    raise exception 'Assessment result evidence must be a JSON object';
  end if;
  if not exists (
    select 1 from public.people_applications
    where org_id = organization_uuid and id = application_uuid
  ) then
    raise exception 'Application not found';
  end if;

  percent_score := round((earned_value / possible_value) * 100, 3);
  passed_value := percent_score >= passing_percent_value;

  insert into public.people_assessment_results (
    org_id,
    application_id,
    assessment_type,
    score,
    max_score,
    result,
    completed_at
  ) values (
    organization_uuid,
    application_uuid,
    btrim(assessment_type_value),
    percent_score,
    100,
    coalesce(result_value, '{}'::jsonb) || jsonb_build_object(
      'earned', earned_value,
      'possible', possible_value,
      'passing_percent', passing_percent_value,
      'passed', passed_value,
      'scoring_version', 'people-assessment-v1'
    ),
    now()
  ) returning id into assessment_id;

  insert into public.audit_logs (
    org_id, user_id, action, table_name, record_id, new_data
  ) values (
    organization_uuid,
    actor,
    'people.assessment.record',
    'people_assessment_results',
    assessment_id::text,
    jsonb_build_object(
      'application_id', application_uuid,
      'assessment_type', btrim(assessment_type_value),
      'score', percent_score,
      'max_score', 100,
      'passed', passed_value
    )
  );

  return assessment_id;
end;
$$;

revoke all on function public.advance_people_application_stage(uuid, uuid, text, text) from public, anon;
revoke all on function public.record_people_assessment_result(uuid, uuid, text, numeric, numeric, numeric, jsonb) from public, anon;

grant execute on function public.advance_people_application_stage(uuid, uuid, text, text) to authenticated;
grant execute on function public.record_people_assessment_result(uuid, uuid, text, numeric, numeric, numeric, jsonb) to authenticated;

commit;
