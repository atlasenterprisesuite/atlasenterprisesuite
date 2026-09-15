import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationPath = resolve(root, 'supabase/migrations/20260915124500_insurance_verification.sql');
const functionRoot = resolve(root, 'supabase/functions/atlas-insurance-verification');
const indexPath = resolve(functionRoot, 'index.ts');
const contextPath = resolve(functionRoot, '_shared/context.ts');
const cryptoPath = resolve(functionRoot, '_shared/crypto.ts');
const repositoryPath = resolve(functionRoot, '_shared/repository.ts');
const deliveryPath = resolve(functionRoot, '_shared/delivery.ts');
const errorsPath = resolve(functionRoot, '_shared/errors.ts');

function source(path: string) {
  expect(existsSync(path)).toBe(true);
  return readFileSync(path, 'utf8');
}

function migrationSql() {
  return source(migrationPath).toLowerCase();
}

describe('ATLAS Insurance verification persistence contract', () => {
  it('defines tenant and user scoped challenge, grant, and audit tables', () => {
    const sql = migrationSql();
    for (const table of [
      'insurance_verification_challenges',
      'insurance_verification_grants',
      'insurance_verification_audit'
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }

    for (const field of [
      'org_id',
      'user_id',
      'scope',
      'resource_id',
      'code_hash',
      'expires_at',
      'attempt_count',
      'resend_count'
    ]) {
      expect(sql).toContain(field);
    }
  });

  it('never persists a plaintext OTP column', () => {
    const sql = migrationSql();
    expect(sql).toContain('code_hash');
    expect(sql).not.toMatch(/\bcode\s+(text|varchar|character varying)\b/);
  });

  it('enables RLS on all Insurance verification persistence tables', () => {
    const sql = migrationSql();
    expect(sql.match(/enable row level security/g)?.length).toBe(3);
    expect(sql).toContain('organization_members');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain("status = 'active'");
  });

  it('keeps challenge mutations server-controlled and code hashes unreadable to authenticated browsers', () => {
    const sql = migrationSql();
    expect(sql).toContain('revoke all on public.insurance_verification_challenges from authenticated');
    expect(sql).toContain('grant select (');
    expect(sql).not.toMatch(/grant select \([^;]*code_hash[^;]*\) on public\.insurance_verification_challenges/);
    expect(sql).not.toContain('grant insert on public.insurance_verification_challenges to authenticated');
    expect(sql).not.toContain('grant update on public.insurance_verification_challenges to authenticated');
  });

  it('defines bounded attempt and resend counters plus active lookup indexes', () => {
    const sql = migrationSql();
    expect(sql).toContain('attempt_count >= 0');
    expect(sql).toContain('attempt_count <= 5');
    expect(sql).toContain('resend_count >= 0');
    expect(sql).toContain('resend_count <= 3');
    expect(sql).toContain('insurance_verification_challenges_active_idx');
    expect(sql).toContain('insurance_verification_grants_active_idx');
  });

  it('uses service-role-only atomic database functions for attempt increments and grant finalization', () => {
    const sql = migrationSql();
    const repository = source(repositoryPath);
    expect(sql).toContain('create or replace function public.increment_insurance_verification_attempt');
    expect(sql).toContain('create or replace function public.finalize_insurance_verification_grant');
    expect(sql).toContain('grant execute on function public.increment_insurance_verification_attempt');
    expect(sql).toContain('grant execute on function public.finalize_insurance_verification_grant');
    expect(sql).toContain('to service_role');
    expect(repository).toContain(".rpc('increment_insurance_verification_attempt'");
    expect(repository).toContain(".rpc('finalize_insurance_verification_grant'");
  });
});

describe('ATLAS Insurance verification Edge Function contract', () => {
  it('defines one authenticated issue, verify, and resend endpoint', () => {
    const index = source(indexPath);
    expect(index).toContain("operation === 'issue'");
    expect(index).toContain("operation === 'verify'");
    expect(index).toContain("operation === 'resend'");
    expect(index).toContain('resolveInsuranceContext');
  });

  it('derives the actor and active organization from authenticated Supabase context', () => {
    const context = source(contextPath);
    expect(context).toContain('auth.getUser');
    expect(context).toContain('organization_members');
    expect(context).toContain("status', 'active'");
    expect(context).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('uses server-only cryptography and a constant-time digest comparison', () => {
    const crypto = source(cryptoPath);
    expect(crypto).toContain('ATLAS_INSURANCE_OTP_SECRET');
    expect(crypto).toContain('crypto.getRandomValues');
    expect(crypto).toContain("name: 'HMAC'");
    expect(crypto).toContain("hash: 'SHA-256'");
    expect(crypto).toContain('constantTimeEqual');
  });

  it('stores only code hashes and keeps verification lifecycle server-controlled', () => {
    const repository = source(repositoryPath);
    expect(repository).toContain('insurance_verification_challenges');
    expect(repository).toContain('insurance_verification_grants');
    expect(repository).toContain('insurance_verification_audit');
    expect(repository).toContain('code_hash');
    expect(repository).not.toMatch(/\.insert\([^)]*\bcode\s*:/s);
  });

  it('fails truthfully when no authorized delivery provider is configured', () => {
    const delivery = source(deliveryPath);
    expect(delivery).toContain('delivery_not_configured');
    expect(delivery).not.toContain('console.log(code)');
    expect(delivery).not.toContain('console.log(input.code)');
  });

  it('exposes the approved stable error contract without returning OTP material', () => {
    const errors = source(errorsPath);
    const index = source(indexPath);
    for (const code of [
      'authentication_required',
      'no_active_organization',
      'invalid_scope',
      'invalid_resource',
      'invalid_code_format',
      'invalid_code',
      'challenge_expired',
      'challenge_consumed',
      'challenge_locked',
      'resend_cooldown',
      'resend_limit_reached',
      'delivery_not_configured',
      'delivery_failed',
      'verification_required'
    ]) {
      expect(errors).toContain(code);
    }
    expect(index).not.toMatch(/code_hash\s*:/);
    expect(index).not.toMatch(/\bcode\s*:\s*code\b/);
  });
});
