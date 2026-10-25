-- ATLAS 777: durable external-effect reservations; no outbound execution or retry.
create table if not exists public.atlas_external_effect_ledger_777 (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  job_id uuid not null references public.execution_runtime_jobs(id),
  effect_key text not null check (length(trim(effect_key)) > 0),
  provider text not null check (length(trim(provider)) > 0),
  provider_idempotency_key text not null check (length(trim(provider_idempotency_key)) > 0),
  status text not null default 'reserved' check (status in ('reserved','unknown','confirmed','rejected')),
  provider_receipt text,
  audit_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, tenant_id, effect_key),
  unique (provider, provider_idempotency_key)
);
create index if not exists atlas_external_effect_ledger_777_job_idx
  on public.atlas_external_effect_ledger_777(org_id, tenant_id, job_id);
alter table public.atlas_external_effect_ledger_777 enable row level security;
revoke all on public.atlas_external_effect_ledger_777 from public, anon, authenticated;
grant select, insert on public.atlas_external_effect_ledger_777 to service_role;
-- Reservations are immutable in this phase. Reconciliation requires a separately
-- reviewed and audited service-only transition; never infer provider failure from a timeout.
create or replace function public.atlas_reserve_external_effect_777(
  p_org_id uuid, p_tenant_id text, p_job_id uuid, p_effect_key text,
  p_provider text, p_provider_idempotency_key text
) returns setof public.atlas_external_effect_ledger_777
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_org_id is null or p_job_id is null
    or nullif(trim(p_tenant_id), '') is null
    or nullif(trim(p_effect_key), '') is null
    or nullif(trim(p_provider), '') is null
    or nullif(trim(p_provider_idempotency_key), '') is null then
    raise exception 'invalid_effect_reservation' using errcode = '22023';
  end if;
  return query
  insert into public.atlas_external_effect_ledger_777
    (org_id, tenant_id, job_id, effect_key, provider, provider_idempotency_key)
  select p_org_id, p_tenant_id, p_job_id, p_effect_key, p_provider, p_provider_idempotency_key
  where exists (
    select 1 from public.execution_runtime_jobs j
    where j.id = p_job_id and j.org_id = p_org_id and j.tenant_id = p_tenant_id
      and j.state in ('claimed', 'running') and j.lease_expires_at > now()
  )
  on conflict do nothing
  returning *;
end;
$$;
revoke all on function public.atlas_reserve_external_effect_777(uuid,text,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.atlas_reserve_external_effect_777(uuid,text,uuid,text,text,text) to service_role;
