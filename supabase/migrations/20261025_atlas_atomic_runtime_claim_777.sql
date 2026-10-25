-- ATLAS 777: atomic claim for existing execution_runtime_jobs.
-- SECURITY DEFINER is intentionally restricted to service_role; no client EXECUTE.
create or replace function public.atlas_claim_execution_runtime_job(
  p_org_id uuid,
  p_tenant_id text,
  p_runtime_id uuid,
  p_runtime_kind text
) returns setof public.execution_runtime_jobs
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_org_id is null or nullif(trim(p_tenant_id), '') is null or p_runtime_id is null
    or p_runtime_kind not in ('local', 'self_hosted', 'cloud_ephemeral') then
    raise exception 'invalid_runtime_claim' using errcode = '22023';
  end if;
  return query
  with eligible as (
    select j.id
    from public.execution_runtime_jobs j
    join public.execution_runtime_registrations r
      on r.id = p_runtime_id
     and r.org_id = j.org_id
     and r.tenant_id = j.tenant_id
     and r.kind = j.runtime_kind
     and r.status = 'online'
     and r.last_seen_at > now() - interval '2 minutes'
    where j.org_id = p_org_id
      and j.tenant_id = p_tenant_id
      and j.runtime_kind = p_runtime_kind
      and j.state = 'queued'
    order by j.created_at, j.id
    for update of j skip locked
    limit 1
  )
  update public.execution_runtime_jobs j
  set runtime_id = p_runtime_id,
      state = 'claimed',
      lease_id = gen_random_uuid(),
      lease_expires_at = now() + interval '5 minutes',
      updated_at = now()
  from eligible
  where j.id = eligible.id
  returning j.*;
end;
$$;
revoke all on function public.atlas_claim_execution_runtime_job(uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.atlas_claim_execution_runtime_job(uuid,text,uuid,text) to service_role;
