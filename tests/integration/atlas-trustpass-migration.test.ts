import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/20261004120000_atlas_trustpass_core.sql');

function sql() {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, 'utf8').toLowerCase();
}

describe('ATLAS TrustPass persistence contract', () => {
  it('defines the five Core Web security tables', () => {
    const source = sql();
    for (const table of [
      'atlas_trust_policies',
      'atlas_trust_risk_events',
      'atlas_trust_challenges',
      'atlas_trust_grants',
      'atlas_webauthn_credentials'
    ]) {
      expect(source).toContain(`create table if not exists public.${table}`);
    }
  });

  it('enforces bounded risk, expiry, consumption, revocation, and credential uniqueness', () => {
    const source = sql();
    expect(source).toMatch(/risk_score\s+smallint[^;]*check\s*\(risk_score\s+between\s+0\s+and\s+100\)/s);
    expect(source).toContain('expires_at');
    expect(source).toContain('consumed_at');
    expect(source).toContain('revoked_at');
    expect(source).toMatch(/unique\s*\(rp_id,\s*user_id,\s*credential_id\)/);
  });

  it('enables RLS and binds user-visible rows to auth.uid plus active organization membership', () => {
    const source = sql();
    expect(source.match(/enable row level security/g)?.length).toBe(5);
    expect(source).toContain('organization_members');
    expect(source).toContain('auth.uid()');
    expect(source).toContain("status = 'active'");
  });

  it('keeps challenge, grant, and credential mutation state server-controlled', () => {
    const source = sql();
    for (const table of ['atlas_trust_challenges', 'atlas_trust_grants', 'atlas_webauthn_credentials']) {
      expect(source).toContain(`revoke all on public.${table} from authenticated`);
      expect(source).not.toContain(`grant insert on public.${table} to authenticated`);
      expect(source).not.toContain(`grant update on public.${table} to authenticated`);
    }
  });

  it('stores only WebAuthn public metadata and no biometric/private/TOTP secret material', () => {
    const source = sql();
    expect(source).toContain('public_key');
    expect(source).toContain('credential_id');
    expect(source).toContain('counter');
    expect(source).not.toMatch(/\bprivate_key\b/);
    expect(source).not.toMatch(/\bbiometric(_template)?\b/);
    expect(source).not.toMatch(/\btotp_secret\b/);
  });
});
