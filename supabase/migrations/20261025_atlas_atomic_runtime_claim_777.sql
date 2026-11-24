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

-- Finishing a job must also be atomic: an expired or stolen lease must not commit.
-- External effects still require separate durable idempotency/reconciliation before retry.
create or replace function public.atlas_complete_execution_runtime_job(
  p_org_id uuid,
  p_tenant_id text,
  p_runtime_id uuid,
  p_job_id uuid,
  p_lease_id uuid,
  p_state text,
  p_result jsonb
) returns setof public.execution_runtime_jobs
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_org_id is null or nullif(trim(p_tenant_id), '') is null
     or p_runtime_id is null or p_job_id is null or p_lease_id is null
     or p_state not in ('completed', 'waiting_human', 'failed') then
    raise exception 'invalid_runtime_completion' using errcode = '22023';
  end if;

  return query
  update public.execution_runtime_jobs j
  set state = p_state,
      sanitized_result = coalesce(p_result, '{}'::jsonb),
      updated_at = now()
  where j.id = p_job_id
    and j.org_id = p_org_id
    and j.tenant_id = p_tenant_id
    and j.runtime_id = p_runtime_id
    and j.lease_id = p_lease_id
    and j.state in ('claimed', 'running')
    and j.lease_expires_at > now()
    and exists (
      select 1 from public.execution_runtime_registrations r
      where r.id = p_runtime_id
        and r.org_id = j.org_id
        and r.tenant_id = j.tenant_id
        and r.kind = j.runtime_kind
        and r.status = 'online'
        and r.last_seen_at > now() - interval '2 minutes'
    )
  returning j.*;
end;
$$;

revoke all on function public.atlas_complete_execution_runtime_job(uuid,text,uuid,uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.atlas_complete_execution_runtime_job(uuid,text,uuid,uuid,uuid,text,jsonb) to service_role;

-- Fail-closed stale-lease reconciliation. Never automatically replay an
-- external side effect without a durable provider idempotency record.
-- Run only from a trusted service worker; row locks prevent racing completion.
create or replace function public.atlas_quarantine_expired_runtime_jobs(
  p_limit integer default 50
) returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'invalid_reconciliation_limit' using errcode = '22023';
  end if;
  with expired as (
    select j.id
    from public.execution_runtime_jobs j
    where j.state in ('claimed', 'running')
      and j.lease_expires_at <= now()
    order by j.lease_expires_at, j.id
    for update skip locked
    limit p_limit
  ), quarantined as (
    update public.execution_runtime_jobs j
    set state = 'waiting_human',
        lease_id = null,
        lease_expires_at = null,
        updated_at = now()
    from expired
    where j.id = expired.id
      and j.state in ('claimed', 'running')
      and j.lease_expires_at <= now()
    returning j.id
  )
  select count(*) into v_count from quarantined;
  return v_count;
end;
$$;
revoke all on function public.atlas_quarantine_expired_runtime_jobs(integer) from public, anon, authenticated;
grant execute on function public.atlas_quarantine_expired_runtime_jobs(integer) to service_role;
