create table public.atlas_ai_models (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connector_id uuid not null references public.atlas_connectors(id) on delete cascade,
  model_key text not null check (model_key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  provider_model_ref text not null check (length(provider_model_ref) between 1 and 160),
  display_name text not null check (length(display_name) between 1 and 120),
  enabled boolean not null default false,
  supports_text boolean not null default true,
  supports_images boolean not null default false,
  supports_audio boolean not null default false,
  supports_tools boolean not null default false,
  supports_structured_output boolean not null default false,
  max_context_tokens integer check (max_context_tokens is null or max_context_tokens > 0),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, model_key),
  unique(org_id, id)
);

create index atlas_ai_models_connector_idx on public.atlas_ai_models(org_id, connector_id, enabled);
alter table public.atlas_ai_models enable row level security;
create policy atlas_ai_models_read on public.atlas_ai_models for select to authenticated using (public.is_org_member(org_id));
create policy atlas_ai_models_insert on public.atlas_ai_models for insert to authenticated with check (public.has_org_role(org_id, array['owner','admin']) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy atlas_ai_models_update on public.atlas_ai_models for update to authenticated using (public.has_org_role(org_id, array['owner','admin'])) with check (public.has_org_role(org_id, array['owner','admin']) and updated_by=(select auth.uid()));
create policy atlas_ai_models_delete on public.atlas_ai_models for delete to authenticated using (public.has_org_role(org_id, array['owner','admin']));
create trigger atlas_updated_atlas_ai_models before update on public.atlas_ai_models for each row execute function public.set_updated_at();
create trigger atlas_audit_atlas_ai_models after insert or update or delete on public.atlas_ai_models for each row execute function public.audit_row_change();

create table public.atlas_ai_routes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  task_class text not null check (task_class ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  environment text not null default 'production' check (environment in ('development','staging','production')),
  model_id uuid not null,
  route_rank smallint not null check (route_rank between 1 and 50),
  enabled boolean not null default true,
  max_latency_ms integer check (max_latency_ms is null or max_latency_ms > 0),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_ai_routes_model_fk foreign key (org_id, model_id) references public.atlas_ai_models(org_id, id) on delete cascade,
  unique(org_id, environment, task_class, route_rank),
  unique(org_id, environment, task_class, model_id)
);

create index atlas_ai_routes_lookup_idx on public.atlas_ai_routes(org_id, environment, task_class, enabled, route_rank);
alter table public.atlas_ai_routes enable row level security;
create policy atlas_ai_routes_read on public.atlas_ai_routes for select to authenticated using (public.is_org_member(org_id));
create policy atlas_ai_routes_insert on public.atlas_ai_routes for insert to authenticated with check (public.has_org_role(org_id, array['owner','admin']) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy atlas_ai_routes_update on public.atlas_ai_routes for update to authenticated using (public.has_org_role(org_id, array['owner','admin'])) with check (public.has_org_role(org_id, array['owner','admin']) and updated_by=(select auth.uid()));
create policy atlas_ai_routes_delete on public.atlas_ai_routes for delete to authenticated using (public.has_org_role(org_id, array['owner','admin']));
create trigger atlas_updated_atlas_ai_routes before update on public.atlas_ai_routes for each row execute function public.set_updated_at();
create trigger atlas_audit_atlas_ai_routes after insert or update or delete on public.atlas_ai_routes for each row execute function public.audit_row_change();

create or replace function public.atlas_ai_route_candidates(
  organization_uuid uuid,
  requested_task_class text,
  environment_name text default 'production'
)
returns table(model_id uuid, model_key text, route_rank smallint, max_latency_ms integer, supports_text boolean, supports_images boolean, supports_audio boolean, supports_tools boolean, supports_structured_output boolean)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select m.id, m.model_key, r.route_rank, r.max_latency_ms,
         m.supports_text, m.supports_images, m.supports_audio, m.supports_tools, m.supports_structured_output
  from public.atlas_ai_routes r
  join public.atlas_ai_models m on m.org_id=r.org_id and m.id=r.model_id
  where r.org_id=organization_uuid
    and r.task_class=requested_task_class
    and r.environment=environment_name
    and r.enabled=true
    and m.enabled=true
    and public.is_org_member(r.org_id)
  order by r.route_rank asc;
$$;

revoke all on function public.atlas_ai_route_candidates(uuid,text,text) from public, anon;
grant execute on function public.atlas_ai_route_candidates(uuid,text,text) to authenticated, service_role;

comment on table public.atlas_ai_models is 'Provider-independent ATLAS AI model registry. Secrets remain in connector secret_ref, never here.';
comment on table public.atlas_ai_routes is 'ATLAS task-to-model routing and fallback order, independent from any specific AI provider.';
comment on function public.atlas_ai_route_candidates(uuid,text,text) is 'Returns enabled ATLAS model candidates in fallback order without exposing provider credentials.';
