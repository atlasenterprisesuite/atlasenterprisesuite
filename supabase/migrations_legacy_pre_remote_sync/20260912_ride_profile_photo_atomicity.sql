create or replace function public.atlas_ride_compliance_finalize_submission(
  p_submission_id uuid,
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_mime_type text,
  p_file_size_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.compliance_submissions%rowtype;
  v_requirement public.compliance_requirements%rowtype;
  v_now timestamptz := now();
  v_expected_prefix text;
begin
  if p_storage_bucket <> 'atlas-compliance-evidence'
     or p_mime_type not in ('image/jpeg','image/png','image/webp')
     or p_file_size_bytes <= 0
     or p_file_size_bytes > 10485760 then
    raise exception 'invalid_photo';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.org_id = p_organization_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
  ) then
    raise exception 'authorization_denied';
  end if;

  select *
  into v_submission
  from public.compliance_submissions cs
  where cs.id = p_submission_id
    and cs.organization_id = p_organization_id
    and cs.tenant_id = p_organization_id
    and cs.subject_user_id = p_actor_user_id
    and cs.submitted_by = p_actor_user_id
  for update;

  if not found then
    raise exception 'requirement_not_found';
  end if;

  select *
  into v_requirement
  from public.compliance_requirements cr
  where cr.id = v_submission.requirement_id
    and cr.organization_id = p_organization_id
    and cr.tenant_id = p_organization_id
    and cr.subject_user_id = p_actor_user_id
    and cr.module = 'ride'
    and cr.subject_type = 'driver'
    and cr.requirement_type = 'profile_photo'
  for update;

  if not found then
    raise exception 'requirement_not_found';
  end if;

  if v_submission.status <> 'uploading'
     or v_requirement.status not in ('action_required','rejected') then
    raise exception 'state_conflict';
  end if;

  v_expected_prefix := p_organization_id::text || '/' || p_organization_id::text || '/' || p_actor_user_id::text
    || '/ride/profile-photo/' || p_submission_id::text || '/';
  if p_storage_path not like v_expected_prefix || '%' or p_storage_path like 'pending/%' then
    raise exception 'invalid_photo';
  end if;

  update public.compliance_submissions
  set status = 'submitted',
      storage_bucket = p_storage_bucket,
      storage_path = p_storage_path,
      mime_type = p_mime_type,
      file_size_bytes = p_file_size_bytes,
      submitted_at = v_now,
      updated_at = v_now
  where id = v_submission.id
  returning * into v_submission;

  update public.compliance_requirements
  set status = 'submitted',
      reason_code = null,
      reason_text = null,
      updated_at = v_now
  where id = v_requirement.id
  returning * into v_requirement;

  insert into public.compliance_audit_events (
    tenant_id,
    organization_id,
    actor_user_id,
    subject_user_id,
    requirement_id,
    submission_id,
    event_type,
    metadata,
    created_at
  ) values (
    p_organization_id,
    p_organization_id,
    p_actor_user_id,
    p_actor_user_id,
    v_requirement.id,
    v_submission.id,
    'submission.submitted',
    jsonb_build_object('mime_type', p_mime_type, 'file_size_bytes', p_file_size_bytes),
    v_now
  );

  return jsonb_build_object(
    'submission', to_jsonb(v_submission),
    'requirement', to_jsonb(v_requirement)
  );
end;
$$;

create or replace function public.atlas_ride_compliance_review_transition(
  p_submission_id uuid,
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_target_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.compliance_submissions%rowtype;
  v_requirement public.compliance_requirements%rowtype;
  v_reason text;
  v_event_type text;
  v_metadata jsonb := '{}'::jsonb;
  v_now timestamptz := now();
begin
  if p_target_status not in ('under_review','approved','rejected') then
    raise exception 'invalid_request';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.org_id = p_organization_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.role in ('owner','admin','platform_admin')
  ) then
    raise exception 'authorization_denied';
  end if;

  select *
  into v_submission
  from public.compliance_submissions cs
  where cs.id = p_submission_id
    and cs.organization_id = p_organization_id
    and cs.tenant_id = p_organization_id
  for update;

  if not found then
    raise exception 'requirement_not_found';
  end if;

  select *
  into v_requirement
  from public.compliance_requirements cr
  where cr.id = v_submission.requirement_id
    and cr.organization_id = p_organization_id
    and cr.tenant_id = p_organization_id
    and cr.subject_user_id = v_submission.subject_user_id
    and cr.module = 'ride'
    and cr.subject_type = 'driver'
    and cr.requirement_type = 'profile_photo'
  for update;

  if not found then
    raise exception 'requirement_not_found';
  end if;

  if p_target_status = 'under_review' then
    if v_submission.status = 'under_review' and v_requirement.status = 'under_review' then
      return jsonb_build_object(
        'submission', to_jsonb(v_submission),
        'requirement', to_jsonb(v_requirement)
      );
    end if;
    if v_submission.status <> 'submitted' or v_requirement.status <> 'submitted' then
      raise exception 'state_conflict';
    end if;

    update public.compliance_submissions
    set status = 'under_review', updated_at = v_now
    where id = v_submission.id
    returning * into v_submission;

    update public.compliance_requirements
    set status = 'under_review', reason_code = null, reason_text = null, updated_at = v_now
    where id = v_requirement.id
    returning * into v_requirement;

    v_event_type := 'review.started';

  elsif p_target_status = 'approved' then
    if v_submission.status <> 'under_review' or v_requirement.status <> 'under_review' then
      raise exception 'state_conflict';
    end if;

    update public.compliance_submissions
    set status = 'approved',
        reviewed_at = v_now,
        reviewed_by = p_actor_user_id,
        decision_reason = null,
        updated_at = v_now
    where id = v_submission.id
    returning * into v_submission;

    update public.compliance_requirements
    set status = 'approved', reason_code = null, reason_text = null, updated_at = v_now
    where id = v_requirement.id
    returning * into v_requirement;

    v_event_type := 'review.approved';

  else
    v_reason := nullif(trim(coalesce(p_reason, '')), '');
    if v_reason is null then
      raise exception 'rejection_reason_required';
    end if;
    if v_submission.status <> 'under_review' or v_requirement.status <> 'under_review' then
      raise exception 'state_conflict';
    end if;

    update public.compliance_submissions
    set status = 'rejected',
        reviewed_at = v_now,
        reviewed_by = p_actor_user_id,
        decision_reason = v_reason,
        updated_at = v_now
    where id = v_submission.id
    returning * into v_submission;

    update public.compliance_requirements
    set status = 'rejected', reason_text = v_reason, updated_at = v_now
    where id = v_requirement.id
    returning * into v_requirement;

    v_event_type := 'review.rejected';
    v_metadata := jsonb_build_object('reason', v_reason);
  end if;

  insert into public.compliance_audit_events (
    tenant_id,
    organization_id,
    actor_user_id,
    subject_user_id,
    requirement_id,
    submission_id,
    event_type,
    metadata,
    created_at
  ) values (
    p_organization_id,
    p_organization_id,
    p_actor_user_id,
    v_submission.subject_user_id,
    v_requirement.id,
    v_submission.id,
    v_event_type,
    v_metadata,
    v_now
  );

  return jsonb_build_object(
    'submission', to_jsonb(v_submission),
    'requirement', to_jsonb(v_requirement)
  );
end;
$$;

revoke execute on function public.atlas_ride_compliance_finalize_submission(uuid,uuid,uuid,text,text,text,bigint) from public;
revoke execute on function public.atlas_ride_compliance_finalize_submission(uuid,uuid,uuid,text,text,text,bigint) from anon;
revoke execute on function public.atlas_ride_compliance_finalize_submission(uuid,uuid,uuid,text,text,text,bigint) from authenticated;
grant execute on function public.atlas_ride_compliance_finalize_submission(uuid,uuid,uuid,text,text,text,bigint) to service_role;

revoke execute on function public.atlas_ride_compliance_review_transition(uuid,uuid,uuid,text,text) from public;
revoke execute on function public.atlas_ride_compliance_review_transition(uuid,uuid,uuid,text,text) from anon;
revoke execute on function public.atlas_ride_compliance_review_transition(uuid,uuid,uuid,text,text) from authenticated;
grant execute on function public.atlas_ride_compliance_review_transition(uuid,uuid,uuid,text,text) to service_role;

comment on function public.atlas_ride_compliance_finalize_submission(uuid,uuid,uuid,text,text,text,bigint) is
  'Atomically finalizes ATLAS Ride profile-photo submission + requirement state and writes submission.submitted audit evidence.';
comment on function public.atlas_ride_compliance_review_transition(uuid,uuid,uuid,text,text) is
  'Atomically transitions ATLAS Ride profile-photo review state and writes the matching review audit event under row locks.';
