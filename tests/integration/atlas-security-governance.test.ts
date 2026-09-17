import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20260917110500_security_protection_governance.sql';

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

const rpcNames = [
  'record_security_risk_event',
  'grant_security_step_up',
  'trust_security_device',
  'revoke_security_device',
  'authorize_security_protected_action',
  'transition_security_action_delay',
  'record_security_session_revocation'
] as const;

describe('ATLAS Device & Account Protection governance contract', () => {
  it('creates every guarded security transition with a fixed search path', () => {
    const sql = readMigration();

    for (const rpc of rpcNames) {
      expect(sql).toMatch(new RegExp(`create or replace function public\\.${rpc}\\b`, 'i'));
      expect(sql).toMatch(new RegExp(`${rpc}[\\s\\S]*security definer[\\s\\S]*set search_path = public, pg_temp`, 'i'));
    }
  });

  it('keeps risk-event and step-up issuance backend-only', () => {
    const sql = readMigration();

    for (const rpc of ['record_security_risk_event', 'grant_security_step_up', 'record_security_session_revocation']) {
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${rpc}[\\s\\S]*from public, anon, authenticated`, 'i'));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${rpc}[\\s\\S]*to service_role`, 'i'));
    }

    expect(sql).toMatch(/grant_security_step_up[\s\S]*security_passkeys[\s\S]*revoked_at is null/i);
    expect(sql).toMatch(/grant_security_step_up[\s\S]*security_risk_events/i);
    expect(sql).toMatch(/interval '10 minutes'/i);
  });

  it('requires authenticated organization membership and a fresh action-scoped passkey grant for device changes', () => {
    const sql = readMigration();

    expect(sql).toMatch(/trust_security_device[\s\S]*Authentication required/i);
    expect(sql).toMatch(/trust_security_device[\s\S]*public\.is_org_member\(current_device\.org_id\)/i);
    expect(sql).toMatch(/trust_security_device[\s\S]*device\.trust/i);
    expect(sql).toMatch(/trust_security_device[\s\S]*expires_at > now\(\)[\s\S]*revoked_at is null/i);
    expect(sql).toMatch(/trust_security_device[\s\S]*status not in \('revoked','compromised'\)/i);

    expect(sql).toMatch(/revoke_security_device[\s\S]*device\.revoke/i);
    expect(sql).toMatch(/revoke_security_device[\s\S]*security\.protection\.manage_org/i);
    expect(sql).toMatch(/revoke_security_device[\s\S]*status = 'revoked'/i);
    expect(sql).toMatch(/revoke_security_device[\s\S]*revoked_at = now\(\)/i);
  });

  it('authorizes only the approved action catalog using a server-created risk event and valid passkey grant', () => {
    const sql = readMigration();

    for (const action of [
      'account.password.change',
      'account.recovery.change',
      'account.passkey.remove',
      'account.protection.disable',
      'account.delete',
      'admin.role.grant',
      'admin.role.revoke',
      'payout.destination.change',
      'api_key.create_privileged',
      'api_key.revoke_privileged',
      'session.revoke_others',
      'device.trust',
      'device.revoke'
    ]) {
      expect(sql).toContain(`'${action}'`);
    }

    expect(sql).toMatch(/authorize_security_protected_action[\s\S]*security_risk_events/i);
    expect(sql).toMatch(/authorize_security_protected_action[\s\S]*current_risk\.user_id = auth\.uid\(\)/i);
    expect(sql).toMatch(/authorize_security_protected_action[\s\S]*current_risk\.action_code = action_code_value/i);
    expect(sql).toMatch(/authorize_security_protected_action[\s\S]*security_step_up_grants/i);
    expect(sql).toMatch(/authorize_security_protected_action[\s\S]*expires_at > now\(\)[\s\S]*revoked_at is null/i);
  });

  it('fails closed for denied/step-up decisions and creates delay server-side only after assurance', () => {
    const sql = readMigration();

    expect(sql).toMatch(/current_risk\.decision = 'deny'[\s\S]*'deny'/i);
    expect(sql).toMatch(/current_risk\.decision = 'step_up'[\s\S]*'step_up'/i);
    expect(sql).toMatch(/current_risk\.decision = 'delay'[\s\S]*insert into public\.security_action_delays/i);
    expect(sql).toMatch(/not_before[\s\S]*now\(\) \+ make_interval\(secs => delay_seconds\)/i);
    expect(sql).toMatch(/greatest\(900, least\(86400/i);
  });

  it('prevents clients from declaring delayed actions executed and requires downstream success evidence', () => {
    const sql = readMigration();

    expect(sql).toMatch(/transition_security_action_delay[\s\S]*next_state = 'cancelled'[\s\S]*auth\.uid\(\)/i);
    expect(sql).toMatch(/transition_security_action_delay[\s\S]*service_role/i);
    expect(sql).toMatch(/next_state = 'executed'[\s\S]*downstream_success_evidence_value is null[\s\S]*raise exception/i);
    expect(sql).toMatch(/'pending','ready'/i);
    expect(sql).toMatch(/'ready','executed'/i);
    expect(sql).toMatch(/'pending','cancelled'/i);
  });

  it('does not represent a database revocation request as provider success', () => {
    const sql = readMigration();

    expect(sql).toMatch(/record_security_session_revocation[\s\S]*provider_status_value in \('requested','provider_succeeded','provider_failed'\)/i);
    expect(sql).toMatch(/provider_status_value = 'provider_succeeded'[\s\S]*provider_reference_value is null[\s\S]*raise exception/i);
    expect(sql).toMatch(/provider_status_value = 'provider_failed'[\s\S]*failure_code_value is null[\s\S]*raise exception/i);
  });

  it('does not grant financial or Network authority through security governance', () => {
    const sql = readMigration();

    expect(sql).not.toMatch(/identity_role_permissions[\s\S]*accounting\./i);
    expect(sql).not.toMatch(/identity_role_permissions[\s\S]*network\./i);
    expect(sql).not.toMatch(/grant execute[\s\S]*post_network_commission_event/i);
    expect(sql).not.toMatch(/grant execute[\s\S]*accounting_/i);
  });
});
