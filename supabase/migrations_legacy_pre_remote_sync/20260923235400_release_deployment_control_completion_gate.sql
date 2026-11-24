-- ATLAS Release & Deployment Control completion gate.
-- Fail closed: returns false unless the canonical baseline, deployment and required gates are present and healthy.

create or replace function public.atlas_release_completion_gate()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  with baseline as (
    select id
    from public.atlas_releases
    where channel='production'
      and status='promoted'
      and metadata->>'baseline'='true'
      and manifest_hash <> repeat('0',64)
  ),
  deployment as (
    select d.id
    from public.atlas_deployments d
    join baseline b on b.id=d.release_id
    where d.environment='production'
      and d.status='promoted'
      and d.provider_execution_state='succeeded'
      and d.health_state='healthy'
  ),
  gates as (
    select
      count(*) filter (where g.required) as required_count,
      count(*) filter (where g.required and g.status in ('passed','waived')) as satisfied_count,
      count(*) filter (where g.required and g.status not in ('passed','waived')) as blocking_count
    from public.atlas_deployment_gates g
    join deployment d on d.id=g.deployment_id
  )
  select
    (select count(*) from baseline)=1
    and (select count(*) from deployment)=1
    and coalesce((select required_count >= 1 and required_count=satisfied_count and blocking_count=0 from gates),false);
$$;

revoke all on function public.atlas_release_completion_gate() from public;
grant execute on function public.atlas_release_completion_gate() to service_role;

comment on function public.atlas_release_completion_gate() is
'Fail-closed ATLAS Release & Deployment Control completion gate. A deployment is not verified unless the production baseline, provider execution, health and every required gate are satisfied.';
