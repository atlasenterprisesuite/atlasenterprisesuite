create or replace function public.atlas_apply_public_www_reconcile_once()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, vault, extensions, pg_temp
as $$
declare
  v_token text;
  v_response extensions.http_response;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','30000');

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'atlas_runtime_verifier_token_v1'
  limit 1;

  if v_token is null or length(v_token) < 32 then
    return jsonb_build_object('ok', false, 'state', 'runtime_verifier_missing');
  end if;

  v_response := extensions.http((
    'POST'::extensions.http_method,
    'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-cloudflare-public-www-reconcile'::varchar,
    array[
      ('x-atlas-runtime-verifier-token', v_token)::extensions.http_header,
      ('Content-Type', 'application/json')::extensions.http_header
    ],
    'application/json'::varchar,
    '{"action":"apply"}'::varchar
  )::extensions.http_request);

  perform extensions.http_reset_curlopt();

  return jsonb_build_object(
    'http_status', v_response.status,
    'body', case when v_response.content is null or v_response.content = '' then '{}'::jsonb else v_response.content::jsonb end
  );
exception when others then
  perform extensions.http_reset_curlopt();
  raise;
end;
$$;

revoke all on function public.atlas_apply_public_www_reconcile_once() from public;
revoke all on function public.atlas_apply_public_www_reconcile_once() from anon;
revoke all on function public.atlas_apply_public_www_reconcile_once() from authenticated;
grant execute on function public.atlas_apply_public_www_reconcile_once() to service_role;
