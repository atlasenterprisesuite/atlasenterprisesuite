-- Atomic, scoped claim of queued runtime jobs.
-- Service-role only: this function is not an end-user API.
create or replace function public.execution_claim_runtime_job_777(
  p_runtime_id uuid,
  p_org_id uuid,
  p_tenant_id text,
  p_runtime_kind text
)
returns setof public.execution_runtime_jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_runtime public.execution_runtime_registrations%rowtype;
begin
  select * into v_runtime
  from public.execution_runtime_registrations
  where id = p_runtime_id and org_id = p_org_id
    and tenant_id = p_tenant_id and kind = p_runtime_kind
    and status <> 'revoked';
  if not found then
    raise exception 'runtime_not_authorized' using errcode = '42501';
  end if;

  return query
  with candidate as (
    select j.id from public.execution_runtime_jobs j
    where j.org_id = p_org_id and j.tenant_id = p_tenant_id
      and j.runtime_kind = p_runtime_kind and j.state = 'queued'
    order by j.created_at, j.id
    for update skip locked
    limit 1
  )
  update public.execution_runtime_jobs j
  set runtime_id = p_runtime_id,
      state = 'claimed',
      lease_id = gen_random_uuid(),
      lease_expires_at = clock_timestamp() + interval '5 minutes',
      updated_at = clock_timestamp()
  from candidate
  where j.id = candidate.id
  returning j.*;
end;
$$;

revoke all on function public.execution_claim_runtime_job_777(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.execution_claim_runtime_job_777(uuid,uuid,text,text) to service_role;
comment on function public.execution_claim_runtime_job_777(uuid,uuid,text,text)
is 'Service-only atomic claim. Runtime bearer authentication and tenant authorization must be validated by the Edge handler before invoking.';
