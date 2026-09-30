import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20260918200000_insurance_totp_mfa_grants.sql';
const mfaClientPath = 'apps/web/src/lib/atlasMfa.ts';
const handlerPath = 'supabase/functions/atlas-insurance-verification/index.ts';
const contextPath = 'supabase/functions/atlas-insurance-verification/_shared/context.ts';
const repositoryPath = 'supabase/functions/atlas-insurance-verification/_shared/repository.ts';
const pagePath = 'apps/web/src/modules/insurance/InsuranceVerificationPage.tsx';

describe('ATLAS Insurance TOTP MFA contract', () => {
  it('defines a service-role-only TOTP grant path without an email challenge', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain("verification_method");
    expect(sql).toContain("'totp'");
    expect(sql).toContain('alter column challenge_id drop not null');
    expect(sql).toContain('create or replace function public.create_insurance_mfa_grant');
    expect(sql).toContain('security definer');
    expect(sql).toContain('to service_role');
    expect(sql).toContain('revoke all on function public.create_insurance_mfa_grant');
  });

  it('adds browser MFA enrollment/challenge/verify support using the existing ATLAS session', () => {
    expect(existsSync(mfaClientPath)).toBe(true);
    const source = readFileSync(mfaClientPath, 'utf8');

    expect(source).toContain("'/auth/v1/factors'");
    expect(source).toContain('/challenge');
    expect(source).toContain('/verify');
    expect(source).toContain("factor_type: 'totp'");
    expect(source).toContain('persistAtlasSession');
  });

  it('requires an authenticated aal2 token with a recent TOTP AMR before granting Insurance access', () => {
    const handler = readFileSync(handlerPath, 'utf8');
    const context = readFileSync(contextPath, 'utf8');
    const repository = readFileSync(repositoryPath, 'utf8');

    expect(context).toContain('accessToken');
    expect(handler).toContain("operation === 'grant_mfa'");
    expect(handler).toContain("payload.aal !== 'aal2'");
    expect(handler).toContain("method === 'totp'");
    expect(handler).toContain('MFA_RECENCY_SECONDS');
    expect(repository).toContain('createInsuranceMfaGrant');
    expect(repository).toContain(".rpc('create_insurance_mfa_grant'");
  });

  it('makes authenticator verification primary while retaining email as an explicit fallback', () => {
    const page = readFileSync(pagePath, 'utf8');

    expect(page).toContain('listAtlasTotpFactors');
    expect(page).toContain('enrollAtlasTotp');
    expect(page).toContain('verifyAtlasTotp');
    expect(page).toContain('grantInsuranceMfa');
    expect(page).toContain('Use email code instead');
    expect(page).toContain('Authenticator app');
  });
});
