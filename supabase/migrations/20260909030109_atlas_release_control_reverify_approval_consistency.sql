alter function atlas_private.evaluate_deployment_gates_internal(uuid) rename to evaluate_deployment_gates_internal_v1;

create or replace function atlas_private.evaluate_deployment_gates_internal(p_deployment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public','atlas_private','pg_temp'
set statement_timeout='30s'
as $$
declare
  d public.atlas_deployments;
  r public.atlas_releases;
  v_policy jsonb;
  v_action text;
  v_approval_ok boolean;
  v_required_failed int;
  v_required_blocked int;
  v_required_pending int;
begin
  perform atlas_private.evaluate_deployment_gates_internal_v1(p_deployment_id);
  select * into d from public.atlas_deployments where id=p_deployment_id;
  if not found then raise exception 'deployment_not_found'; end if;
  select * into r from public.atlas_releases where id=d.release_id;
  if not found then raise exception 'release_not_found'; end if;

  v_action:=case when d.deployment_kind='reverify' then 'reverify' else 'promote' end;
  v_policy:=public.atlas_release_requires_approval(r.id,d.environment,v_action);
  v_approval_ok:=not coalesce((v_policy->>'required')::boolean,false);
  if not v_approval_ok and d.approval_id is not null then
    select exists(
      select 1 from public.atlas_approvals a
      where a.id=d.approval_id and a.status='approved' and a.expires_at>now()
        and a.subject_type='deployment' and a.subject_id=d.id::text and a.action='release.promote'
    ) into v_approval_ok;
  end if;
  if exists(select 1 from public.atlas_deployment_gates where deployment_id=d.id and gate_key='approval_policy') then
    perform atlas_private.set_deployment_gate_internal(
      d.id,'approval_policy',case when v_approval_ok then 'passed' else 'blocked' end,
      null,d.approval_id,case when v_action='reverify' then 'supabase-native:reverify-policy' else null end,
      case when not v_approval_ok then 'approval_missing_or_expired' end,null
    );
  end if;

  select count(*) filter(where required and status in ('failed','expired')),
         count(*) filter(where required and status='blocked'),
         count(*) filter(where required and status in ('pending','running'))
    into v_required_failed,v_required_blocked,v_required_pending
  from public.atlas_deployment_gates where deployment_id=d.id;

  return jsonb_build_object('deployment_id',d.id,'failed',v_required_failed,'blocked',v_required_blocked,'pending',v_required_pending,'evaluated_at',now());
end;
$$;

revoke all on function atlas_private.evaluate_deployment_gates_internal_v1(uuid) from public,anon,authenticated;
revoke all on function atlas_private.evaluate_deployment_gates_internal(uuid) from public,anon,authenticated;
grant execute on function atlas_private.evaluate_deployment_gates_internal(uuid) to service_role;
