create or replace function public.atlas_bulk_approve_safe(p_org_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_approved integer := 0;
  v_skipped_sensitive integer := 0;
  v_skipped_expired integer := 0;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if not public.has_identity_permission(p_org_id, 'approvals.decide') then
    raise exception 'approval_permission_required';
  end if;

  select count(*) into v_skipped_expired
  from public.atlas_approvals
  where org_id = p_org_id
    and status = 'pending'
    and expires_at <= now();

  select count(*) into v_skipped_sensitive
  from public.atlas_approvals
  where org_id = p_org_id
    and status = 'pending'
    and expires_at > now()
    and (
      risk_level in ('high','critical')
      or coalesce((metadata->>'destructive')::boolean, false)
      or coalesce((metadata->>'irreversible')::boolean, false)
      or coalesce((metadata->>'requires_manual_review')::boolean, false)
      or coalesce((metadata->>'requires_secret')::boolean, false)
      or coalesce((metadata->>'external_commitment')::boolean, false)
      or coalesce((metadata->>'bulk_approvable')::boolean, true) = false
    );

  update public.atlas_approvals
  set status = 'approved',
      decision_note = 'bulk_approved_safe_via_atlas_manager'
  where org_id = p_org_id
    and status = 'pending'
    and expires_at > now()
    and risk_level in ('low','medium')
    and not coalesce((metadata->>'destructive')::boolean, false)
    and not coalesce((metadata->>'irreversible')::boolean, false)
    and not coalesce((metadata->>'requires_manual_review')::boolean, false)
    and not coalesce((metadata->>'requires_secret')::boolean, false)
    and not coalesce((metadata->>'external_commitment')::boolean, false)
    and coalesce((metadata->>'bulk_approvable')::boolean, true);

  get diagnostics v_approved = row_count;

  return jsonb_build_object(
    'ok', true,
    'organization_id', p_org_id,
    'approved', v_approved,
    'skipped_sensitive', v_skipped_sensitive,
    'skipped_expired', v_skipped_expired,
    'actor_id', v_actor,
    'decided_at', now()
  );
end;
$$;

revoke all on function public.atlas_bulk_approve_safe(uuid) from public, anon;
grant execute on function public.atlas_bulk_approve_safe(uuid) to authenticated;

create or replace function public.atlas_dispatch_approved_conversations(p_org_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_queued integer := 0;
  v_already_queued integer := 0;
  v_total_approved integer := 0;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if not public.has_org_role(p_org_id, array['owner','admin','manager']) then
    raise exception 'manager_role_required';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_org_id::text || ':atlas_dispatch_approved_conversations'));

  select count(*) into v_total_approved
  from public.atlas_conversation_executions c
  where c.org_id = p_org_id
    and c.status = 'approved';

  select count(*) into v_already_queued
  from public.atlas_conversation_executions c
  where c.org_id = p_org_id
    and c.status = 'approved'
    and exists (
      select 1
      from public.atlas_outbox o
      where o.org_id = c.org_id
        and o.channel = 'atlas-manager'
        and o.destination_ref = 'conversation-execution:' || c.id::text
        and o.status in ('queued','processing','sent')
    );

  insert into public.atlas_outbox (org_id, channel, destination_ref, payload, status, created_by)
  select
    c.org_id,
    'atlas-manager',
    'conversation-execution:' || c.id::text,
    jsonb_build_object(
      'event', 'conversation.execution.requested',
      'conversation_execution_id', c.id,
      'project_id', c.project_id,
      'work_unit_id', c.work_unit_id,
      'intent', c.intent,
      'requested_action', c.requested_action,
      'execution_policy', c.execution_policy,
      'requested_by', v_actor,
      'requested_at', now()
    ),
    'queued',
    v_actor
  from public.atlas_conversation_executions c
  where c.org_id = p_org_id
    and c.status = 'approved'
    and not exists (
      select 1
      from public.atlas_outbox o
      where o.org_id = c.org_id
        and o.channel = 'atlas-manager'
        and o.destination_ref = 'conversation-execution:' || c.id::text
        and o.status in ('queued','processing','sent')
    );

  get diagnostics v_queued = row_count;

  return jsonb_build_object(
    'ok', true,
    'organization_id', p_org_id,
    'approved_total', v_total_approved,
    'queued_now', v_queued,
    'already_queued', v_already_queued,
    'execution_state', 'queued_for_runtime',
    'actor_id', v_actor,
    'queued_at', now()
  );
end;
$$;

revoke all on function public.atlas_dispatch_approved_conversations(uuid) from public, anon;
grant execute on function public.atlas_dispatch_approved_conversations(uuid) to authenticated;
