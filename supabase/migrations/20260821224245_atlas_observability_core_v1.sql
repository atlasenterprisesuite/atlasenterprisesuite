create table public.atlas_trace_spans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  trace_id uuid not null,
  span_id uuid not null default gen_random_uuid(),
  parent_span_id uuid,
  actor_id uuid default auth.uid(),
  module text not null check (module ~ '^[A-Za-z0-9._-]{2,64}$'),
  operation text not null check (operation ~ '^[A-Za-z0-9._:/-]{2,96}$'),
  status text not null default 'ok' check (status in ('ok','error','cancelled','timeout')),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 86400000),
  error_code text check (error_code is null or error_code ~ '^[A-Za-z0-9._:-]{1,96}$'),
  environment text not null default 'production' check (environment in ('development','staging','production')),
  release_ref text check (release_ref is null or (length(release_ref) between 1 and 96 and release_ref ~ '^[A-Za-z0-9._:/-]+$')),
  occurred_at timestamptz not null default now(),
  unique(org_id, span_id)
);

create index atlas_trace_spans_org_time_idx on public.atlas_trace_spans(org_id, occurred_at desc);
create index atlas_trace_spans_trace_idx on public.atlas_trace_spans(org_id, trace_id, occurred_at);
create index atlas_trace_spans_error_idx on public.atlas_trace_spans(org_id, status, occurred_at desc) where status <> 'ok';

alter table public.atlas_trace_spans enable row level security;

create policy atlas_trace_spans_insert on public.atlas_trace_spans
  for insert to authenticated
  with check (public.is_org_member(org_id) and actor_id = auth.uid());

create policy atlas_trace_spans_read on public.atlas_trace_spans
  for select to authenticated
  using (public.has_org_role(org_id, array['owner','admin','manager']));

create table public.atlas_operational_metrics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid default auth.uid(),
  metric_name text not null check (metric_name ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  metric_value numeric not null check (metric_value <> 'NaN'::numeric),
  unit text not null default 'count' check (unit in ('count','ms','bytes','percent','usd','tokens','items')),
  module text not null check (module ~ '^[A-Za-z0-9._-]{2,64}$'),
  environment text not null default 'production' check (environment in ('development','staging','production')),
  release_ref text check (release_ref is null or (length(release_ref) between 1 and 96 and release_ref ~ '^[A-Za-z0-9._:/-]+$')),
  recorded_at timestamptz not null default now()
);

create index atlas_operational_metrics_org_time_idx on public.atlas_operational_metrics(org_id, recorded_at desc);
create index atlas_operational_metrics_name_idx on public.atlas_operational_metrics(org_id, metric_name, recorded_at desc);

alter table public.atlas_operational_metrics enable row level security;

create policy atlas_operational_metrics_insert on public.atlas_operational_metrics
  for insert to authenticated
  with check (public.is_org_member(org_id) and actor_id = auth.uid());

create policy atlas_operational_metrics_read on public.atlas_operational_metrics
  for select to authenticated
  using (public.has_org_role(org_id, array['owner','admin','manager']));

create or replace function public.capture_atlas_trace_span(
  organization_uuid uuid,
  trace_uuid uuid,
  module_name text,
  operation_name text,
  span_status text default 'ok',
  elapsed_ms integer default null,
  normalized_error_code text default null,
  environment_name text default 'production',
  release_reference text default null,
  parent_span_uuid uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(organization_uuid) then raise exception 'Organization membership required'; end if;

  insert into public.atlas_trace_spans(
    org_id, trace_id, parent_span_id, actor_id, module, operation, status,
    duration_ms, error_code, environment, release_ref
  ) values (
    organization_uuid, trace_uuid, parent_span_uuid, auth.uid(), module_name, operation_name,
    span_status, elapsed_ms, normalized_error_code, environment_name, release_reference
  ) returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.capture_atlas_metric(
  organization_uuid uuid,
  metric_key text,
  metric_number numeric,
  metric_unit text,
  module_name text,
  environment_name text default 'production',
  release_reference text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(organization_uuid) then raise exception 'Organization membership required'; end if;

  insert into public.atlas_operational_metrics(
    org_id, actor_id, metric_name, metric_value, unit, module, environment, release_ref
  ) values (
    organization_uuid, auth.uid(), metric_key, metric_number, metric_unit, module_name,
    environment_name, release_reference
  ) returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.capture_atlas_trace_span(uuid,uuid,text,text,text,integer,text,text,text,uuid) from public, anon;
grant execute on function public.capture_atlas_trace_span(uuid,uuid,text,text,text,integer,text,text,text,uuid) to authenticated, service_role;
revoke all on function public.capture_atlas_metric(uuid,text,numeric,text,text,text,text) from public, anon;
grant execute on function public.capture_atlas_metric(uuid,text,numeric,text,text,text,text) to authenticated, service_role;

comment on table public.atlas_trace_spans is 'ATLAS sovereign privacy-minimized distributed trace spans. Append-only for authenticated users.';
comment on table public.atlas_operational_metrics is 'ATLAS sovereign privacy-minimized operational metrics. Provider-independent and tenant-scoped.';
