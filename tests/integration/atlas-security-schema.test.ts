import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20260917110000_security_protection_core.sql';

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

const tables = [
  'security_devices',
  'security_passkeys',
  'security_webauthn_challenges',
  'security_risk_events',
  'security_step_up_grants',
  'security_action_delays',
  'security_recovery_events',
  'security_session_revocations'
] as const;

const permissions = [
  'security.protection.view_self',
  'security.protection.manage_self',
  'security.protection.audit_self',
  'security.protection.view_org',
  'security.protection.manage_org',
  'security.protection.audit_org',
  'security.protection.policy_manage'
] as const;

describe('ATLAS Device & Account Protection schema contract', () => {
  it('creates every approved tenant-scoped security table with RLS enabled', () => {
    const sql = readMigration();

    for (const table of tables) {
      expect(sql).toMatch(new RegExp(`create table if not exists public\\.${table}\\b`, 'i'));
      expect(sql).toMatch(new RegExp(`create table if not exists public\\.${table}[\\s\\S]*?org_id uuid not null references public\\.organizations\\(id\\)`, 'i'));
      expect(sql).toMatch(new RegExp(`create table if not exists public\\.${table}[\\s\\S]*?user_id uuid not null references auth\\.users\\(id\\)`, 'i'));
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    }
  });

  it('models device trust and passkeys without biometric or private-key storage', () => {
    const sql = readMigration();

    expect(sql).toMatch(/create table if not exists public\.security_devices[\s\S]*status text not null default 'untrusted'[\s\S]*check \(status in \('untrusted','trusted','revoked','compromised'\)\)/i);
    expect(sql).toMatch(/security_devices[\s\S]*trusted_at timestamptz/i);
    expect(sql).toMatch(/security_devices[\s\S]*trusted_by_user_id uuid references auth\.users\(id\)/i);
    expect(sql).toMatch(/security_devices[\s\S]*trust_expires_at timestamptz/i);

    expect(sql).toMatch(/create table if not exists public\.security_passkeys[\s\S]*credential_id text not null/i);
    expect(sql).toMatch(/create unique index if not exists security_passkeys_credential_id_uidx[\s\S]*credential_id/i);
    expect(sql).toMatch(/security_passkeys[\s\S]*credential_public_key bytea not null/i);
    expect(sql).toMatch(/security_passkeys[\s\S]*counter bigint not null default 0/i);
    expect(sql).not.toMatch(/biometric_(template|data)/i);
    expect(sql).not.toMatch(/private_key/i);
    expect(sql).not.toMatch(/authenticator_pin/i);
  });

  it('makes WebAuthn challenges short-lived, scoped and single-use', () => {
    const sql = readMigration();

    expect(sql).toMatch(/security_webauthn_challenges[\s\S]*purpose text not null[\s\S]*check \(purpose in \('registration','authentication'\)\)/i);
    expect(sql).toMatch(/security_webauthn_challenges[\s\S]*challenge text not null/i);
    expect(sql).toMatch(/security_webauthn_challenges[\s\S]*expected_action text/i);
    expect(sql).toMatch(/security_webauthn_challenges[\s\S]*expires_at timestamptz not null/i);
    expect(sql).toMatch(/security_webauthn_challenges[\s\S]*consumed_at timestamptz/i);
    expect(sql).toMatch(/check \(expires_at <= created_at \+ interval '5 minutes'\)/i);
    expect(sql).toMatch(/unique \(challenge\)/i);
  });

  it('persists explainable risk, short-lived passkey grants and truthful session revocation states', () => {
    const sql = readMigration();

    expect(sql).toMatch(/security_risk_events[\s\S]*decision text not null[\s\S]*check \(decision in \('allow','step_up','delay','deny'\)\)/i);
    expect(sql).toMatch(/security_risk_events[\s\S]*score integer not null[\s\S]*between 0 and 100/i);
    expect(sql).toMatch(/security_risk_events[\s\S]*signals_used jsonb not null/i);
    expect(sql).toMatch(/security_risk_events[\s\S]*signals_unknown jsonb not null/i);
    expect(sql).toMatch(/security_risk_events[\s\S]*policy_version text not null/i);

    expect(sql).toMatch(/security_step_up_grants[\s\S]*method text not null default 'passkey'/i);
    expect(sql).toMatch(/security_step_up_grants[\s\S]*action_code text not null/i);
    expect(sql).toMatch(/security_step_up_grants[\s\S]*expires_at timestamptz not null/i);
    expect(sql).toMatch(/check \(expires_at <= created_at \+ interval '10 minutes'\)/i);

    expect(sql).toMatch(/security_session_revocations[\s\S]*provider_status text not null default 'requested'[\s\S]*check \(provider_status in \('requested','provider_succeeded','provider_failed'\)\)/i);
    expect(sql).toMatch(/security_session_revocations[\s\S]*provider_reference text/i);
    expect(sql).toMatch(/security_session_revocations[\s\S]*failure_code text/i);
  });

  it('stores server-governed delay and append-only recovery evidence', () => {
    const sql = readMigration();

    expect(sql).toMatch(/security_action_delays[\s\S]*state text not null default 'pending'[\s\S]*check \(state in \('pending','ready','executed','cancelled','expired','denied'\)\)/i);
    expect(sql).toMatch(/security_action_delays[\s\S]*action_code text not null/i);
    expect(sql).toMatch(/security_action_delays[\s\S]*target_reference text/i);
    expect(sql).toMatch(/security_action_delays[\s\S]*not_before timestamptz not null/i);
    expect(sql).toMatch(/security_action_delays[\s\S]*downstream_success_evidence jsonb/i);

    expect(sql).toMatch(/revoke update, delete on public\.security_risk_events from anon, authenticated/i);
    expect(sql).toMatch(/revoke update, delete on public\.security_recovery_events from anon, authenticated/i);
  });

  it('registers the exact security permissions and owner/admin organization authority', () => {
    const sql = readMigration();

    for (const permission of permissions) {
      expect(sql).toContain(`('${permission}'`);
    }

    for (const role of ['owner', 'admin']) {
      for (const permission of [
        'security.protection.view_org',
        'security.protection.manage_org',
        'security.protection.audit_org',
        'security.protection.policy_manage'
      ]) {
        expect(sql).toContain(`('${role}','${permission}')`);
      }
    }
  });

  it('limits reads to self or explicitly elevated organization security permissions', () => {
    const sql = readMigration();

    expect(sql).toContain('public.is_org_member(org_id)');
    expect(sql).toContain('user_id = auth.uid()');
    expect(sql).toContain("public.has_identity_permission(org_id,'security.protection.view_org')");
    expect(sql).toContain("public.has_identity_permission(org_id,'security.protection.audit_org')");
    expect(sql).toContain("public.has_identity_permission(org_id,'security.protection.manage_org')");
  });

  it('revokes direct privileged browser mutations and audits mutable security state', () => {
    const sql = readMigration();

    for (const table of [
      'security_passkeys',
      'security_webauthn_challenges',
      'security_risk_events',
      'security_step_up_grants',
      'security_action_delays',
      'security_recovery_events',
      'security_session_revocations'
    ]) {
      expect(sql).toMatch(new RegExp(`revoke insert, update, delete on public\\.${table} from anon, authenticated`, 'i'));
    }

    for (const table of [
      'security_devices',
      'security_passkeys',
      'security_step_up_grants',
      'security_action_delays',
      'security_session_revocations'
    ]) {
      expect(sql).toMatch(new RegExp(`create trigger ${table}_audit[\\s\\S]*on public\\.${table}[\\s\\S]*public\\.audit_row_change\\(\\)`, 'i'));
    }
  });
});
