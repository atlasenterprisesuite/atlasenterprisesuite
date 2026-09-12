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
    and cr.requirement_type = 'profile_photo'
  for update;

  if not found then
    raise exception 'requirement_not_found';
  end if;

  if p_target_status = 'under_review' then
    if v_submission.status = 'under_review' and v_requirement.status = 'under_review' then
      return jsonb_build_object(
        'submission_id', v_submission.id,
        'requirement_id', v_requirement.id,
        'submission_status', v_submission.status,
        'requirement_status', v_requirement.status
      );
    end if;

    if v_submission.status <> 'submitted' or v_requirement.status <> 'submitted' then
      raise exception 'state_conflict';
    end if;

    update public.compliance_submissions
    set status = 'under_review',
        updated_at = v_now
    where id = v_submission.id;

    update public.compliance_requirements
    set status = 'under_review',
        reason_code = null,
        reason_text = null,
        updated_at = v_now
    where id = v_requirement.id;

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
    where id = v_submission.id;

    update public.compliance_requirements
    set status = 'approved',
        reason_code = null,
        reason_text = null,
        updated_at = v_now
    where id = v_requirement.id;

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
    where id = v_submission.id;

    update public.compliance_requirements
    set status = 'rejected',
        reason_text = v_reason,
        updated_at = v_now
    where id = v_requirement.id;
  end if;

  return jsonb_build_object(
    'submission_id', v_submission.id,
    'requirement_id', v_requirement.id,
    'submission_status', p_target_status,
    'requirement_status', p_target_status,
    'reviewed_at', case when p_target_status in ('approved','rejected') then v_now else null end,
    'decision_reason', case when p_target_status = 'rejected' then v_reason else null end
  );
end;
$$;

revoke execute on function public.atlas_ride_compliance_review_transition(uuid,uuid,uuid,text,text) from public;
revoke execute on function public.atlas_ride_compliance_review_transition(uuid,uuid,uuid,text,text) from anon;
revoke execute on function public.atlas_ride_compliance_review_transition(uuid,uuid,uuid,text,text) from authenticated;
grant execute on function public.atlas_ride_compliance_review_transition(uuid,uuid,uuid,text,text) to service_role;

comment on function public.atlas_ride_compliance_review_transition(uuid,uuid,uuid,text,text) is
  'Atomically transitions ATLAS Ride profile-photo submission and requirement review state under row locks; callable only by the server service role after explicit reviewer authorization.';
