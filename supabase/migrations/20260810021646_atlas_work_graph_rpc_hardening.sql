-- ATLAS Work Graph RPC privilege hardening
-- Keep the conversation capture RPC available only to signed-in users and
-- prevent the internal organization seed trigger function from being called
-- directly through the exposed API schema.
begin;

revoke all on function public.capture_atlas_conversation_execution(
  uuid, text, text, text, text, text, text, text
) from public;
revoke all on function public.capture_atlas_conversation_execution(
  uuid, text, text, text, text, text, text, text
) from anon;
grant execute on function public.capture_atlas_conversation_execution(
  uuid, text, text, text, text, text, text, text
) to authenticated;

revoke all on function public.seed_atlas_work_modules() from public;
revoke all on function public.seed_atlas_work_modules() from anon;
revoke all on function public.seed_atlas_work_modules() from authenticated;

commit;
