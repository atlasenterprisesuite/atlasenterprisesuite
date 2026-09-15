import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260915124500_insurance_verification.sql');

function migrationSql() {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, 'utf8').toLowerCase();
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
});
