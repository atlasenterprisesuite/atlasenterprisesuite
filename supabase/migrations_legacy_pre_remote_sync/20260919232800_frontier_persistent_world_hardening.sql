-- ATLAS FRONTIER persistent world hardening.
-- Remove direct trigger execution and optimize Frontier FK/RLS access paths.

revoke all on function public.frontier_persist_legacy_habitat_position()
  from public, anon, authenticated;

create index if not exists frontier_runs_tenant_idx
  on public.frontier_runs (tenant_id);
create index if not exists frontier_runs_actor_idx
  on public.frontier_runs (actor_user_id);

create index if not exists frontier_events_tenant_idx
  on public.frontier_events (tenant_id);
create index if not exists frontier_events_run_idx
  on public.frontier_events (run_id);
create index if not exists frontier_events_actor_idx
  on public.frontier_events (actor_user_id);

create index if not exists frontier_structures_tenant_idx
  on public.frontier_structures (tenant_id);
create index if not exists frontier_structures_run_idx
  on public.frontier_structures (run_id);
create index if not exists frontier_structures_actor_idx
  on public.frontier_structures (actor_user_id);

drop policy if exists frontier_runs_read_own on public.frontier_runs;
create policy frontier_runs_read_own
  on public.frontier_runs for select to authenticated
  using (
    actor_user_id = (select auth.uid())
    and (
      public.has_identity_permission(org_id, 'frontier.read')
      or public.has_identity_permission(org_id, 'frontier.play')
      or public.has_identity_permission(org_id, 'frontier.manage')
    )
  );

drop policy if exists frontier_events_read on public.frontier_events;
create policy frontier_events_read
  on public.frontier_events for select to authenticated
  using (
    (actor_user_id = (select auth.uid()) and public.has_identity_permission(org_id, 'frontier.read'))
    or public.has_identity_permission(org_id, 'frontier.manage')
  );

drop policy if exists frontier_structures_read_own on public.frontier_structures;
create policy frontier_structures_read_own
  on public.frontier_structures for select to authenticated
  using (
    actor_user_id = (select auth.uid())
    and (
      public.has_identity_permission(org_id, 'frontier.read')
      or public.has_identity_permission(org_id, 'frontier.play')
      or public.has_identity_permission(org_id, 'frontier.manage')
    )
  );

comment on function public.frontier_build_structure(uuid,text,text,double precision,double precision,double precision,double precision) is
  'Authenticated ATLAS FRONTIER server-authoritative spatial build RPC. SECURITY DEFINER is intentional; the function validates auth.uid(), organization permissions, bounds, collisions, resources and idempotency before writes.';
