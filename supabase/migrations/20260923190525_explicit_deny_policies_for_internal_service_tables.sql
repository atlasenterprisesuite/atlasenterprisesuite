do $$
declare
  t text;
begin
  foreach t in array array[
    'atlas_ai_emergency_budget_reservations',
    'atlas_integration_credentials',
    'atlas_local_agent_enrollments',
    'atlas_local_agent_sessions',
    'atlas_local_ai_runtimes',
    'atlas_orchestrator_events',
    'atlas_orchestrator_tasks',
    'creator_content_workspaces',
    'creator_web_launch_blueprints'
  ]
  loop
    execute format('drop policy if exists internal_service_only on public.%I', t);
    execute format(
      'create policy internal_service_only on public.%I for all to anon, authenticated using (false) with check (false)',
      t
    );
  end loop;
end $$;
