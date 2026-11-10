grant execute on function public.atlas_orchestrator_create_task(text, text, text, integer, text, jsonb, timestamptz, timestamptz) to anon;
grant execute on function public.atlas_orchestrator_get_task(text, text, text) to anon;
grant execute on function public.atlas_orchestrator_save_task(text, text, text, integer, text, jsonb, timestamptz) to anon;
grant execute on function public.atlas_orchestrator_append_event(text, text, text, text, text, jsonb, timestamptz) to anon;
grant execute on function public.atlas_orchestrator_list_events(text, text, text) to anon;
