create or replace function public.atlas_bulk_approve_safe(p_org_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_approved integer := 0;
  v_conversations_approved integer := 0;
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
      or lower(coalesce(metadata->>'destructive','false')) in ('true','1','yes','on')
      or lower(coalesce(metadata->>'irreversible','false')) in ('true','1','yes','on')
      or lower(coalesce(metadata->>'requires_manual_review','false')) in ('true','1','yes','on')
      or lower(coalesce(metadata->>'requires_secret','false')) in ('true','1','yes','on')
      or lower(coalesce(metadata->>'external_commitment','false')) in ('true','1','yes','on')
      or lower(coalesce(metadata->>'bulk_approvable','true')) in ('false','0','no','off')
    );

  with approved as (
    update public.atlas_approvals
    set status = 'approved',
        decision_note = 'bulk_approved_safe_via_atlas_manager'
    where org_id = p_org_id
      and status = 'pending'
      and expires_at > now()
      and risk_level in ('low','medium')
      and lower(coalesce(metadata->>'destructive','false')) not in ('true','1','yes','on')
      and lower(coalesce(metadata->>'irreversible','false')) not in ('true','1','yes','on')
      and lower(coalesce(metadata->>'requires_manual_review','false')) not in ('true','1','yes','on')
      and lower(coalesce(metadata->>'requires_secret','false')) not in ('true','1','yes','on')
      and lower(coalesce(metadata->>'external_commitment','false')) not in ('true','1','yes','on')
      and lower(coalesce(metadata->>'bulk_approvable','true')) not in ('false','0','no','off')
    returning subject_type, subject_id
  ), conversation_updates as (
    update public.atlas_conversation_executions c
    set status = 'approved', updated_at = now()
    where c.org_id = p_org_id
      and c.status in ('captured','planned','blocked')
      and c.id::text in (
        select a.subject_id
        from approved a
        where a.subject_type = 'conversation_execution'
          and a.subject_id is not null
      )
    returning c.id
  )
  select
    (select count(*) from approved),
    (select count(*) from conversation_updates)
  into v_approved, v_conversations_approved;

  return jsonb_build_object(
    'ok', true,
    'organization_id', p_org_id,
    'approved', v_approved,
    'conversation_executions_approved', v_conversations_approved,
    'skipped_sensitive', v_skipped_sensitive,
    'skipped_expired', v_skipped_expired,
    'actor_id', v_actor,
    'decided_at', now()
  );
end;
$$;

revoke all on function public.atlas_bulk_approve_safe(uuid) from public, anon;
grant execute on function public.atlas_bulk_approve_safe(uuid) to authenticated;
