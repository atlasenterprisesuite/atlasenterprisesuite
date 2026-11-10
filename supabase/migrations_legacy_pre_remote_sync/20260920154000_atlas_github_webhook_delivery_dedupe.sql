create table if not exists public.atlas_github_webhook_deliveries (
  tenant_id text not null,
  organization_id text not null,
  delivery_id text not null,
  event_type text not null,
  action text,
  installation_id bigint,
  repository_full_name text,
  received_at timestamptz not null default now(),
  primary key (tenant_id, organization_id, delivery_id)
);

create index if not exists atlas_github_webhook_deliveries_received_idx
  on public.atlas_github_webhook_deliveries (tenant_id, organization_id, received_at desc);

alter table public.atlas_github_webhook_deliveries enable row level security;
revoke all on public.atlas_github_webhook_deliveries from anon, authenticated;

create or replace function public.atlas_orchestrator_claim_github_delivery(
  p_tenant_id text,
  p_organization_id text,
  p_delivery_id text,
  p_event_type text,
  p_action text,
  p_installation_id bigint,
  p_repository_full_name text,
  p_received_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if not private.atlas_orchestrator_runtime_authorized() then
    raise insufficient_privilege using message = 'atlas_orchestrator_runtime_unauthorized';
  end if;

  insert into public.atlas_github_webhook_deliveries (
    tenant_id,
    organization_id,
    delivery_id,
    event_type,
    action,
    installation_id,
    repository_full_name,
    received_at
  ) values (
    p_tenant_id,
    p_organization_id,
    p_delivery_id,
    p_event_type,
    p_action,
    p_installation_id,
    p_repository_full_name,
    p_received_at
  )
  on conflict (tenant_id, organization_id, delivery_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

revoke all on function public.atlas_orchestrator_claim_github_delivery(text,text,text,text,text,bigint,text,timestamptz)
  from public, authenticated;
grant execute on function public.atlas_orchestrator_claim_github_delivery(text,text,text,text,text,bigint,text,timestamptz)
  to anon;
