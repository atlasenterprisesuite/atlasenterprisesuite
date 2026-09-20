-- These RPCs run as their postgres owner and bypass RLS. They are internal
-- orchestrator endpoints, so public and user sessions must never execute them.
revoke all on function public.atlas_orchestrator_create_task(text,text,text,integer,text,jsonb,timestamptz,timestamptz)
  from public, anon, authenticated;
revoke all on function public.atlas_orchestrator_get_task(text,text,text)
  from public, anon, authenticated;
revoke all on function public.atlas_orchestrator_save_task(text,text,text,integer,text,jsonb,timestamptz)
  from public, anon, authenticated;
revoke all on function public.atlas_orchestrator_append_event(text,text,text,text,text,jsonb,timestamptz)
  from public, anon, authenticated;
revoke all on function public.atlas_orchestrator_list_events(text,text,text)
  from public, anon, authenticated;

grant execute on function public.atlas_orchestrator_create_task(text,text,text,integer,text,jsonb,timestamptz,timestamptz)
  to service_role;
grant execute on function public.atlas_orchestrator_get_task(text,text,text)
  to service_role;
grant execute on function public.atlas_orchestrator_save_task(text,text,text,integer,text,jsonb,timestamptz)
  to service_role;
grant execute on function public.atlas_orchestrator_append_event(text,text,text,text,text,jsonb,timestamptz)
  to service_role;
grant execute on function public.atlas_orchestrator_list_events(text,text,text)
  to service_role;
