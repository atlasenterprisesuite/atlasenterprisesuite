-- Normalize Commerce downstream delivery states and expose a service-role leasing function.

alter table public.commerce_integration_deliveries
  drop constraint if exists commerce_integration_deliveries_status_check;

alter table public.commerce_integration_deliveries
  add constraint commerce_integration_deliveries_status_check
  check (status in (
    'pending',
    'dispatched',
    'fulfilled',
    'retrying',
    'failed',
    'dead_lettered',
    'resolved'
  ));

update public.commerce_integration_deliveries
set status = case status
  when 'processing' then 'dispatched'
  when 'delivered' then 'fulfilled'
  when 'blocked' then 'failed'
  else status
end
where status in ('processing','delivered','blocked');

create or replace function public.commerce_claim_integration_deliveries(
  p_limit integer default 25,
  p_lease_timeout interval default interval '5 minutes'
)
returns table (
  id uuid,
  tenant_id uuid,
  org_id uuid,
  event_id uuid,
  target_module text,
  attempt_count integer,
  correlation_id text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'INVALID_CLAIM_LIMIT';
  end if;

  return query
  with candidates as (
    select d.id
    from public.commerce_integration_deliveries d
    where d.status in ('pending','retrying')
       or (
         d.status = 'dispatched'
         and coalesce(d.last_attempt_at, d.created_at) < now() - p_lease_timeout
       )
    order by d.created_at asc
    for update skip locked
    limit p_limit
  )
  update public.commerce_integration_deliveries d
  set status = 'dispatched',
      attempt_count = d.attempt_count + 1,
      last_attempt_at = now(),
      updated_at = now()
  from candidates c
  where d.id = c.id
  returning
    d.id,
    d.tenant_id,
    d.org_id,
    d.event_id,
    d.target_module,
    d.attempt_count,
    d.event_id::text;
end;
$$;

revoke all on function public.commerce_claim_integration_deliveries(integer, interval)
  from public, anon, authenticated;
grant execute on function public.commerce_claim_integration_deliveries(integer, interval)
  to service_role;

comment on function public.commerce_claim_integration_deliveries(integer, interval) is
  'Claims Commerce integration deliveries with row locking and skip-locked leasing. Orders are not mutated by downstream delivery failures.';
