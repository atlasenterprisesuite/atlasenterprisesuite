revoke all on function public.atlas_orchestrator_append_event(text,text,text,text,text,jsonb,timestamptz) from anon, public;
revoke all on function public.atlas_orchestrator_create_task(text,text,text,integer,text,jsonb,timestamptz,timestamptz) from anon, public;
revoke all on function public.atlas_orchestrator_get_github_app_credentials() from anon, public;
revoke all on function public.atlas_orchestrator_get_task(text,text,text) from anon, public;
revoke all on function public.atlas_orchestrator_list_events(text,text,text) from anon, public;
revoke all on function public.atlas_orchestrator_save_task(text,text,text,integer,text,jsonb,timestamptz) from anon, public;
revoke all on function public.atlas_orchestrator_store_github_app_credentials(text,text,text,text,text) from anon, public;
revoke all on function public.atlas_orchestrator_store_github_installation(bigint,text) from anon, public;

grant execute on function public.atlas_orchestrator_append_event(text,text,text,text,text,jsonb,timestamptz) to service_role;
grant execute on function public.atlas_orchestrator_create_task(text,text,text,integer,text,jsonb,timestamptz,timestamptz) to service_role;
grant execute on function public.atlas_orchestrator_get_github_app_credentials() to service_role;
grant execute on function public.atlas_orchestrator_get_task(text,text,text) to service_role;
grant execute on function public.atlas_orchestrator_list_events(text,text,text) to service_role;
grant execute on function public.atlas_orchestrator_save_task(text,text,text,integer,text,jsonb,timestamptz) to service_role;
grant execute on function public.atlas_orchestrator_store_github_app_credentials(text,text,text,text,text) to service_role;
grant execute on function public.atlas_orchestrator_store_github_installation(bigint,text) to service_role;
