create or replace function public.hash_atlas_insurance_verification_code(
  p_challenge_id uuid,
  p_code text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  otp_secret text;
begin
  if p_challenge_id is null then
    raise invalid_parameter_value using message = 'insurance_challenge_id_required';
  end if;

  if p_code is null or p_code !~ '^[0-9]{6}$' then
    raise invalid_parameter_value using message = 'invalid_code_format';
  end if;

  select secret
    into otp_secret
    from vault.decrypted_secrets
   where name = 'atlas_insurance_otp_secret'
   limit 1;

  if otp_secret is null or length(otp_secret) < 32 then
    raise exception using message = 'atlas_insurance_otp_secret_not_configured';
  end if;

  return encode(
    extensions.hmac(p_challenge_id::text || ':' || p_code, otp_secret, 'sha256'),
    'hex'
  );
end;
$$;

revoke all on function public.hash_atlas_insurance_verification_code(uuid,text) from public, anon, authenticated;
grant execute on function public.hash_atlas_insurance_verification_code(uuid,text) to service_role;

comment on function public.hash_atlas_insurance_verification_code(uuid,text) is
  'Hashes ATLAS Insurance six-digit verification codes with a Vault-backed server secret. The secret never leaves PostgreSQL and the function is executable only by service_role.';
