import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20260918155000_atlas_insurance_otp_vault_secret.sql';
const cryptoPath = 'supabase/functions/atlas-insurance-verification/_shared/crypto.ts';
const repositoryPath = 'supabase/functions/atlas-insurance-verification/_shared/repository.ts';
const handlerPath = 'supabase/functions/atlas-insurance-verification/index.ts';

describe('ATLAS Insurance OTP Vault secret contract', () => {
  it('keeps the HMAC secret in Supabase Vault behind a service-role-only RPC', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('vault.decrypted_secrets');
    expect(sql).toContain("name = 'atlas_insurance_otp_secret'");
    expect(sql).toContain('extensions.hmac');
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('revoke all on function public.hash_atlas_insurance_verification_code(uuid,text) from public, anon, authenticated');
    expect(sql).toContain('grant execute on function public.hash_atlas_insurance_verification_code(uuid,text) to service_role');
  });

  it('does not read a dedicated OTP secret from Edge Function environment variables', () => {
    const crypto = readFileSync(cryptoPath, 'utf8');
    expect(crypto).not.toContain('ATLAS_INSURANCE_OTP_SECRET');
    expect(crypto).not.toContain("Deno.env.get('ATLAS_INSURANCE_OTP_SECRET')");
  });

  it('hashes candidate codes through the server-only database boundary', () => {
    const repository = readFileSync(repositoryPath, 'utf8');
    const handler = readFileSync(handlerPath, 'utf8');

    expect(repository).toContain('hashInsuranceVerificationCode');
    expect(repository).toContain(".rpc('hash_atlas_insurance_verification_code'");
    expect(handler).toContain('hashInsuranceVerificationCode');
    expect(handler).toContain('constantTimeEqual');
  });
});
