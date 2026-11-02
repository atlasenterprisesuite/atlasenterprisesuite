alter table public.atlas_outbox add column if not exists max_attempts integer not null default 5 check (max_attempts between 1 and 20);
alter table public.atlas_outbox add column if not exists locked_at timestamptz;
alter table public.atlas_outbox add column if not exists lock_token uuid;
alter table public.atlas_outbox add column if not exists dead_lettered_at timestamptz;
alter table public.atlas_outbox add column if not exists last_error_code text check (last_error_code is null or last_error_code ~ '^[A-Za-z0-9._:-]{1,96}$');

alter table public.atlas_outbox drop constraint if exists atlas_outbox_status_check;
alter table public.atlas_outbox add constraint atlas_outbox_status_check check (status = any (array['queued'::text,'processing'::text,'sent'::text,'failed'::text,'dead_letter'::text,'cancelled'::text]));

create index if not exists atlas_outbox_claim_v2_idx on public.atlas_outbox(status, next_attempt_at, created_at) where status in ('queued','failed');
create index if not exists atlas_outbox_dead_letter_idx on public.atlas_outbox(org_id, dead_lettered_at desc) where status='dead_letter';

create or replace function public.atlas_claim_outbox_batch(batch_limit integer default 20)
returns table(
  id uuid,
  org_id uuid,
  event_id bigint,
  channel text,
  destination_ref text,
  payload jsonb,
  attempts integer,
  max_attempts integer,
  lock_token uuid
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if batch_limit < 1 or batch_limit > 100 then
    raise exception 'Batch limit must be between 1 and 100';
  end if;

  return query
  with candidates as (
    select o.id
    from public.atlas_outbox o
    where o.status in ('queued','failed')
      and o.attempts < o.max_attempts
      and coalesce(o.next_attempt_at, now()) <= now()
      and (o.locked_at is null or o.locked_at < now() - interval '5 minutes')
    order by o.created_at
    for update skip locked
    limit batch_limit
  )
  update public.atlas_outbox o
  set status='processing',
      attempts=o.attempts+1,
      locked_at=now(),
      lock_token=gen_random_uuid(),
      updated_at=now()
  from candidates c
  where o.id=c.id
  returning o.id,o.org_id,o.event_id,o.channel,o.destination_ref,o.payload,o.attempts,o.max_attempts,o.lock_token;
end;
$$;

create or replace function public.atlas_outbox_mark_sent(outbox_uuid uuid, claim_token uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare affected integer;
begin
  update public.atlas_outbox
  set status='sent', next_attempt_at=null, last_error=null, last_error_code=null,
      locked_at=null, lock_token=null, updated_at=now()
  where id=outbox_uuid and status='processing' and lock_token=claim_token;
  get diagnostics affected = row_count;
  return affected=1;
end;
$$;

create or replace function public.atlas_outbox_mark_failed(outbox_uuid uuid, claim_token uuid, normalized_error_code text)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare current_attempts integer;
declare allowed_attempts integer;
declare next_status text;
declare retry_seconds integer;
begin
  if normalized_error_code is null or normalized_error_code !~ '^[A-Za-z0-9._:-]{1,96}$' then
    raise exception 'Invalid normalized error code';
  end if;

  select attempts,max_attempts into current_attempts,allowed_attempts
  from public.atlas_outbox
  where id=outbox_uuid and status='processing' and lock_token=claim_token
  for update;

  if current_attempts is null then
    return 'not_claimed';
  end if;

  if current_attempts >= allowed_attempts then
    next_status := 'dead_letter';
    update public.atlas_outbox
    set status='dead_letter', dead_lettered_at=now(), next_attempt_at=null,
        last_error=null, last_error_code=normalized_error_code,
        locked_at=null, lock_token=null, updated_at=now()
    where id=outbox_uuid;
  else
    next_status := 'failed';
    retry_seconds := least(3600, (5 * power(2, greatest(current_attempts-1,0)))::integer);
    update public.atlas_outbox
    set status='failed', next_attempt_at=now() + make_interval(secs => retry_seconds),
        last_error=null, last_error_code=normalized_error_code,
        locked_at=null, lock_token=null, updated_at=now()
    where id=outbox_uuid;
  end if;

  return next_status;
end;
$$;

revoke all on function public.atlas_claim_outbox_batch(integer) from public, anon, authenticated;
grant execute on function public.atlas_claim_outbox_batch(integer) to service_role;
revoke all on function public.atlas_outbox_mark_sent(uuid,uuid) from public, anon, authenticated;
grant execute on function public.atlas_outbox_mark_sent(uuid,uuid) to service_role;
revoke all on function public.atlas_outbox_mark_failed(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.atlas_outbox_mark_failed(uuid,uuid,text) to service_role;

comment on function public.atlas_claim_outbox_batch(integer) is 'ATLAS service-only atomic outbox claim using SKIP LOCKED. Prevents duplicate workers from processing the same delivery.';
comment on function public.atlas_outbox_mark_failed(uuid,uuid,text) is 'ATLAS service-only exponential retry and dead-letter transition using normalized error codes only.';
