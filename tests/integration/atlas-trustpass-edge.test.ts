import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const functionRoot = resolve(root, 'supabase/functions/atlas-trustpass');
const indexPath = resolve(functionRoot, 'index.ts');
const contextPath = resolve(functionRoot, '_shared/context.ts');
const repositoryPath = resolve(functionRoot, '_shared/repository.ts');
const riskPath = resolve(functionRoot, '_shared/risk.ts');
const errorsPath = resolve(functionRoot, '_shared/errors.ts');
const webauthnPath = resolve(functionRoot, '_shared/webauthn.ts');
const webPackagePath = resolve(root, 'apps/web/package.json');
const lockPath = resolve(root, 'package-lock.json');
const migrationPath = resolve(root, 'supabase/migrations/20261004120000_atlas_trustpass_core.sql');

function source(path: string) {
  expect(existsSync(path)).toBe(true);
  return readFileSync(path, 'utf8');
}

describe('ATLAS TrustPass authenticated evaluation boundary', () => {
  it('defines an authenticated evaluate operation and derives identity server-side', () => {
    const index = source(indexPath);
    const context = source(contextPath);

    expect(index).toContain("operation === 'evaluate'");
    expect(index).toContain('resolveTrustContext');
    expect(index).not.toContain('body.org_id');
    expect(index).not.toContain('body.organization_id');
    expect(index).not.toContain('body.user_id');

    expect(context).toContain('auth.getUser');
    expect(context).toContain('organization_members');
    expect(context).toContain(".eq('status', 'active')");
    expect(context).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('reuses the canonical TrustPass domain rather than duplicating scoring rules', () => {
    const risk = source(riskPath);
    expect(risk).toContain("packages/trustpass/src/index.ts");
    expect(risk).toContain('calculateRisk');
    expect(risk).toContain('evaluateTrustDecision');
    expect(risk).not.toMatch(/score\s*\+=\s*\d+/);
  });

  it('loads versioned policy and persists decision evidence with shadow as the safe default', () => {
    const repository = source(repositoryPath);
    const risk = source(riskPath);

    expect(repository).toContain('atlas_trust_policies');
    expect(repository).toContain(".order('version', { ascending: false })");
    expect(repository).toContain('atlas_trust_risk_events');
    expect(risk).toContain("mode: policy?.mode === 'enforce' ? 'enforce' : 'shadow'");
  });

  it('keeps P2/P3 risk recommendations non-blocking in shadow while hard integrity failures stay fail-closed', () => {
    const risk = source(riskPath);
    expect(risk).toContain('recommendedDecision');
    expect(risk).toContain('trust_replay_detected');
    expect(risk).toContain('trust_tenant_mismatch');
    expect(risk).toContain('trust_session_mismatch');
    expect(risk).toContain('trust_action_mismatch');
  });

  it('returns the stable safe evaluation contract', () => {
    const index = source(indexPath);
    for (const field of [
      'decision',
      'recommended_decision',
      'risk_score',
      'risk_band',
      'reason_codes',
      'policy_id',
      'policy_version',
      'correlation_id',
      'mode'
    ]) {
      expect(index).toContain(field);
    }
  });

  it('defines stable errors without exposing scoring internals', () => {
    const errors = source(errorsPath);
    for (const code of [
      'authentication_required',
      'active_organization_required',
      'invalid_operation',
      'invalid_action_type',
      'invalid_action_class',
      'trust_policy_not_found',
      'trust_replay_detected',
      'trust_tenant_mismatch',
      'trust_session_mismatch',
      'trust_action_mismatch',
      'trust_rate_limited',
      'trust_temporarily_held',
      'trust_denied',
      'trust_not_configured'
    ]) {
      expect(errors).toContain(code);
    }
    expect(errors).not.toContain('reason weight');
  });
});

describe('ATLAS TrustPass WebAuthn boundary', () => {
  it('pins the reviewed SimpleWebAuthn versions and keeps server verification in the Edge boundary', () => {
    const webPackage = JSON.parse(source(webPackagePath));
    const lock = source(lockPath);
    const webauthn = source(webauthnPath);

    expect(webPackage.dependencies?.['@simplewebauthn/browser']).toBe('14.0.0');
    expect(lock).toContain('"node_modules/@simplewebauthn/browser"');
    expect(lock).toContain('"version": "14.0.0"');
    expect(webauthn).toContain("npm:@simplewebauthn/server@14.0.3");
    expect(webauthn).toContain('generateRegistrationOptions');
    expect(webauthn).toContain('verifyRegistrationResponse');
    expect(webauthn).toContain('generateAuthenticationOptions');
    expect(webauthn).toContain('verifyAuthenticationResponse');
  });

  it('requires fresh server challenges with RP, origin, user-verification, tenant, session, and action binding', () => {
    const index = source(indexPath);
    const webauthn = source(webauthnPath);
    const repository = source(repositoryPath);
    const migration = source(migrationPath);

    expect(index).toContain("operation === 'webauthn.register.options'");
    expect(index).toContain("operation === 'webauthn.register.verify'");
    expect(index).toContain("operation === 'webauthn.stepup.options'");
    expect(index).toContain("operation === 'webauthn.stepup.verify'");
    expect(webauthn).toContain('expectedChallenge');
    expect(webauthn).toContain('expectedOrigin');
    expect(webauthn).toContain('expectedRPID');
    expect(webauthn).toContain('requireUserVerification: true');
    expect(repository).toContain('session_id');
    expect(repository).toContain('organization_id');
    expect(repository).toContain('action_hash');
    expect(repository).toContain('consumed_at');
    expect(migration).toContain('challenge_value text not null');
  });

  it('rejects expired, consumed, cross-tenant, cross-session, wrong-action, and unowned credential verification', () => {
    const repository = source(repositoryPath);
    const index = source(indexPath);

    for (const code of [
      'trust_challenge_expired',
      'trust_challenge_consumed',
      'trust_tenant_mismatch',
      'trust_session_mismatch',
      'trust_action_mismatch',
      'trust_webauthn_verification_failed'
    ]) {
      expect(index + repository + source(errorsPath)).toContain(code);
    }
    expect(repository).toContain('credential_id');
    expect(repository).toContain('user_id');
    expect(repository).toContain('rp_id');
  });

  it('persists only public credential metadata and creates short-lived phishing-resistant grants', () => {
    const repository = source(repositoryPath);
    const migration = source(migrationPath);

    expect(repository).toContain('atlas_webauthn_credentials');
    expect(repository).toContain('public_key');
    expect(repository).toContain('counter');
    expect(repository).toContain('backup_eligible');
    expect(repository).toContain('backup_state');
    expect(repository).toContain('atlas_trust_grants');
    expect(repository).toContain("assurance_level: 'phishing_resistant'");
    expect(repository).toContain("authenticator_method: 'webauthn'");
    expect(repository).toContain("single_use: input.actionClass === 'P0'");
    expect(migration).not.toMatch(/\bprivate_key\b/);
    expect(migration).not.toMatch(/\bbiometric(_template)?\b/);
  });
});
