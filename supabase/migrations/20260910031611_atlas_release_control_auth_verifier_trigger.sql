create or replace function public.atlas_trigger_release_control_auth_verification()
returns bigint
language plpgsql
security definer
set search_path to 'public','vault','net','pg_temp'
as $$
declare
  v_token text;
  v_request_id bigint;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name='atlas_runtime_verifier_token_v1'
  limit 1;

  if v_token is null or length(v_token)<32 then
    raise exception 'runtime_verifier_token_missing';
  end if;

  select net.http_post(
    url := 'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-release-control-auth-verifier?api=verify',
    headers := jsonb_build_object('Content-Type','application/json','x-atlas-runtime-verifier-token',v_token),
    body := jsonb_build_object('source','supabase-native','requested_at',now()),
    timeout_milliseconds := 120000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.atlas_trigger_release_control_auth_verification() from public,anon,authenticated;
grant execute on function public.atlas_trigger_release_control_auth_verification() to service_role;
