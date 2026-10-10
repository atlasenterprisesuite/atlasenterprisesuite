-- Secure server-side OAuth configuration for ATLAS CRM.
-- Secrets remain encrypted in Supabase Vault and can only be read/written
-- through service-role-only SECURITY DEFINER RPCs.

create or replace function public.atlas_get_server_secret(p_name text)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret text;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'secret name is required';
  end if;

  select decrypted_secret
    into v_secret
  from vault.decrypted_secrets
  where name = p_name
  order by updated_at desc
  limit 1;

  return v_secret;
end;
$$;

create or replace function public.atlas_set_server_secret(
  p_name text,
  p_secret text,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'secret name is required';
  end if;
  if p_secret is null or p_secret = '' then
    raise exception 'secret value is required';
  end if;

  select id
    into v_id
  from vault.secrets
  where name = p_name
  order by updated_at desc
  limit 1;

  if v_id is null then
    perform vault.create_secret(p_secret, p_name, p_description);
  else
    perform vault.update_secret(v_id, p_secret, p_name, p_description);
  end if;
end;
$$;

revoke all on function public.atlas_get_server_secret(text) from public, anon, authenticated;
revoke all on function public.atlas_set_server_secret(text, text, text) from public, anon, authenticated;

grant execute on function public.atlas_get_server_secret(text) to service_role;
grant execute on function public.atlas_set_server_secret(text, text, text) to service_role;
