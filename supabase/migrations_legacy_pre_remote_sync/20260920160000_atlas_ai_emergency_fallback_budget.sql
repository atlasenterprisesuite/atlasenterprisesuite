create table if not exists public.atlas_ai_emergency_budget_reservations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  trace_id uuid not null,
  provider text not null check (provider = 'openai'),
  reserve_usd numeric(12,6) not null check (reserve_usd > 0),
  daily_budget_usd numeric(12,6) not null check (daily_budget_usd > 0),
  status text not null default 'reserved' check (status in ('reserved','completed','failed')),
  created_at timestamptz not null default now(),
  unique (org_id, trace_id, provider)
);

create index if not exists atlas_ai_emergency_budget_reservations_period_idx
  on public.atlas_ai_emergency_budget_reservations (org_id, provider, created_at desc);

alter table public.atlas_ai_emergency_budget_reservations enable row level security;

revoke all on table public.atlas_ai_emergency_budget_reservations from public, anon, authenticated;

create or replace function public.atlas_reserve_ai_emergency_budget(
  p_org_id uuid,
  p_actor_id uuid,
  p_trace_id uuid,
  p_provider text,
  p_reserve_usd numeric,
  p_daily_budget_usd numeric
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
declare
  v_existing public.atlas_ai_emergency_budget_reservations%rowtype;
  v_period_start timestamptz;
  v_authorized numeric(12,6);
  v_reservation_id uuid;
begin
  if p_org_id is null or p_actor_id is null or p_trace_id is null then
    raise exception 'invalid_emergency_budget_context';
  end if;
  if p_provider <> 'openai' then
    raise exception 'emergency_provider_not_allowed';
  end if;
  if p_reserve_usd is null or p_reserve_usd <= 0 or p_daily_budget_usd is null or p_daily_budget_usd <= 0 then
    raise exception 'emergency_budget_not_configured';
  end if;
  if p_reserve_usd > p_daily_budget_usd then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'emergency_request_exceeds_daily_budget',
      'remaining_usd', p_daily_budget_usd
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_org_id::text || ':' || current_date::text || ':' || p_provider, 0)
  );

  select *
    into v_existing
    from public.atlas_ai_emergency_budget_reservations
   where org_id = p_org_id
     and trace_id = p_trace_id
     and provider = p_provider
   limit 1;

  if found then
    return jsonb_build_object(
      'allowed', true,
      'reason', 'existing_reservation',
      'reservation_id', v_existing.id,
      'reserved_usd', v_existing.reserve_usd,
      'daily_budget_usd', v_existing.daily_budget_usd
    );
  end if;

  v_period_start := date_trunc('day', timezone('UTC', now())) at time zone 'UTC';

  select coalesce(sum(reserve_usd), 0)
    into v_authorized
    from public.atlas_ai_emergency_budget_reservations
   where org_id = p_org_id
     and provider = p_provider
     and created_at >= v_period_start;

  if v_authorized + p_reserve_usd > p_daily_budget_usd then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'emergency_daily_budget_exhausted',
      'authorized_usd', v_authorized,
      'requested_reserve_usd', p_reserve_usd,
      'daily_budget_usd', p_daily_budget_usd,
      'remaining_usd', greatest(p_daily_budget_usd - v_authorized, 0)
    );
  end if;

  insert into public.atlas_ai_emergency_budget_reservations (
    org_id,
    actor_id,
    trace_id,
    provider,
    reserve_usd,
    daily_budget_usd
  ) values (
    p_org_id,
    p_actor_id,
    p_trace_id,
    p_provider,
    p_reserve_usd,
    p_daily_budget_usd
  )
  returning id into v_reservation_id;

  return jsonb_build_object(
    'allowed', true,
    'reason', 'emergency_budget_reserved',
    'reservation_id', v_reservation_id,
    'reserved_usd', p_reserve_usd,
    'authorized_usd', v_authorized + p_reserve_usd,
    'daily_budget_usd', p_daily_budget_usd,
    'remaining_usd', greatest(p_daily_budget_usd - (v_authorized + p_reserve_usd), 0)
  );
end
$$;

revoke all on function public.atlas_reserve_ai_emergency_budget(uuid, uuid, uuid, text, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.atlas_reserve_ai_emergency_budget(uuid, uuid, uuid, text, numeric, numeric)
  to service_role;

comment on table public.atlas_ai_emergency_budget_reservations is
  'Fail-closed server-side authorization ledger for paid ATLAS Intelligence emergency fallback. Reservations are conservative and are not provider invoices.';
