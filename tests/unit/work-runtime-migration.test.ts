import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/migrations/20260912_atlas_work_runtime.sql', 'utf8');

describe('ATLAS Work runtime persistence', () => {
  it('creates tenant and organization scoped support tables', () => {
    for (const table of ['execution_connection_refs', 'execution_runtime_registrations', 'execution_runtime_jobs']) {
      expect(source).toContain(`create table if not exists public.${table}`);
    }
    expect(source.match(/org_id/g)?.length).toBeGreaterThan(3);
    expect(source.match(/tenant_id/g)?.length).toBeGreaterThan(3);
  });

  it('stores runtime token hashes only', () => {
    expect(source).toContain('auth_token_hash');
    expect(source).not.toMatch(/auth_token\s+text/i);
    expect(source).not.toContain('token_value');
  });

  it('keeps connection metadata opaque and secret free', () => {
    expect(source).toContain('external_ref');
    expect(source).not.toMatch(/\bpassword\b/i);
    expect(source).not.toMatch(/\bcookie\b/i);
    expect(source).not.toMatch(/\bsecret\s+text/i);
  });

  it('persists constrained job envelope and lease state', () => {
    for (const field of ['execution_envelope', 'action', 'sanitized_result', 'lease_id', 'lease_expires_at']) {
      expect(source).toContain(field);
    }
    expect(source).toContain('enable row level security');
    expect(source).toContain('for select to authenticated');
  });
});
