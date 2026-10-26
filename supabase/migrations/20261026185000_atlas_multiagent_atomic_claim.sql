-- ATLAS 777: isolated durable multi-agent dispatch claims.
-- No provider is invoked by this migration. Apply only after isolated PostgreSQL tests.
create table if not exists public.atlas_multiagent_dispatch_claims (
  tenant_id text not null,
  organization_id text not null,
  idempotency_key text not null,
  task_id text not null,
  provider_id text not null,
  status text not null default 'claimed' check (status in ('claimed','blocked','failed','completed')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, organization_id, idempotency_key),
  foreign key (tenant_id, organization_id, task_id)
    references public.atlas_orchestrator_tasks (tenant_id, organization_id, task_id)
    on delete cascade
);
alter table public.atlas_multiagent_dispatch_claims enable row level security;
revoke all on public.atlas_multiagent_dispatch_claims from public, anon, authenticated;
-- A runtime token alone does not authorize arbitrary tenant selection.
-- Callers must derive tenant and organization from a verified server-side actor.
create or replace function private.atlas_multiagent_claim_internal(
  p_tenant_id text, p_organization_id text, p_idempotency_key text,
  p_task_id text, p_provider_id text
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare inserted_count integer;
begin
  if not private.atlas_orchestrator_runtime_authorized() then
    raise insufficient_privilege using message = 'atlas_orchestrator_runtime_unauthorized';
  end if;
  if nullif(btrim(p_tenant_id),'') is null or nullif(btrim(p_organization_id),'') is null
    or nullif(btrim(p_idempotency_key),'') is null or nullif(btrim(p_task_id),'') is null
    or nullif(btrim(p_provider_id),'') is null then
    raise check_violation using message = 'atlas_multiagent_invalid_claim';
  end if;
  if not exists (
    select 1 from public.atlas_orchestrator_tasks
    where tenant_id=p_tenant_id and organization_id=p_organization_id and task_id=p_task_id
  ) then
    raise foreign_key_violation using message = 'atlas_multiagent_task_scope_missing';
  end if;
  insert into public.atlas_multiagent_dispatch_claims
    (tenant_id,organization_id,idempotency_key,task_id,provider_id)
  values (p_tenant_id,p_organization_id,p_idempotency_key,p_task_id,p_provider_id)
  on conflict (tenant_id,organization_id,idempotency_key) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;
revoke all on function private.atlas_multiagent_claim_internal(text,text,text,text,text) from public, authenticated;
grant execute on function private.atlas_multiagent_claim_internal(text,text,text,text,text) to anon, service_role;
create or replace function public.atlas_multiagent_claim(
  p_tenant_id text, p_organization_id text, p_idempotency_key text,
  p_task_id text, p_provider_id text
) returns boolean language sql security invoker set search_path = ''
as $$
 select private.atlas_multiagent_claim_internal(p_tenant_id,p_organization_id,p_idempotency_key,p_task_id,p_provider_id);
$$;
revoke all on function public.atlas_multiagent_claim(text,text,text,text,text) from public, authenticated;
grant execute on function public.atlas_multiagent_claim(text,text,text,text,text) to anon, service_role;
