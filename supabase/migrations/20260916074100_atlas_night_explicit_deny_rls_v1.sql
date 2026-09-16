create policy atlas_night_queue_no_client_access on public.atlas_night_queue
  for all to anon, authenticated using (false) with check (false);
create policy atlas_night_checkpoints_no_client_access on public.atlas_night_checkpoints
  for all to anon, authenticated using (false) with check (false);
create policy atlas_night_sessions_no_client_access on public.atlas_night_sessions
  for all to anon, authenticated using (false) with check (false);
create policy atlas_night_audit_no_client_access on public.atlas_night_audit_events
  for all to anon, authenticated using (false) with check (false);
create policy atlas_orchestrator_tasks_no_client_access on public.atlas_orchestrator_tasks
  for all to anon, authenticated using (false) with check (false);
create policy atlas_orchestrator_events_no_client_access on public.atlas_orchestrator_events
  for all to anon, authenticated using (false) with check (false);
