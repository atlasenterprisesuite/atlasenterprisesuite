import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = 'supabase/functions/atlas-security-protection';
const read = (path: string) => readFileSync(`${root}/${path}`, 'utf8');

describe('ATLAS Device & Account Protection Edge/WebAuthn contract', () => {
  it('requires authenticated bearer context and active organization membership', () => {
    const source = read('_shared/context.ts');
    expect(source).toMatch(/authorization[\s\S]*bearer/i);
    expect(source).toMatch(/auth\.getUser\(\)/i);
    expect(source).toMatch(/organization_members/i);
    expect(source).toMatch(/\.eq\(['"]status['"],\s*['"]active['"]\)/i);
    expect(source).toMatch(/authentication_required/i);
    expect(source).toMatch(/active_organization_required/i);
  });

  it('pins the vetted WebAuthn server library and keeps RP configuration server-side', () => {
    const source = read('_shared/webauthn.ts');
    expect(source).toContain("npm:@simplewebauthn/server@14.0.2");
    expect(source).toContain("Deno.env.get('ATLAS_WEBAUTHN_RP_ID')");
    expect(source).toContain("Deno.env.get('ATLAS_WEBAUTHN_RP_NAME')");
    expect(source).toContain("Deno.env.get('ATLAS_WEBAUTHN_ORIGIN')");
    expect(source).not.toMatch(/body\.(rpID|rpId|origin)/);
    expect(source).toMatch(/webauthn_not_configured/);
  });

  it('requires discoverable passkeys and user verification for registration', () => {
    const source = read('_shared/webauthn.ts');
    expect(source).toMatch(/generateRegistrationOptions/);
    expect(source).toMatch(/residentKey:\s*['"]required['"]/);
    expect(source).toMatch(/userVerification:\s*['"]required['"]/);
    expect(source).toMatch(/verifyRegistrationResponse/);
    expect(source).toMatch(/requireUserVerification:\s*true/);
    expect(source).toMatch(/expectedRPID:\s*config\.rpId/);
    expect(source).toMatch(/expectedOrigin:\s*config\.origin/);
  });

  it('requires user verification for authentication and creates action-scoped assurance only after success', () => {
    const source = read('_shared/webauthn.ts');
    expect(source).toMatch(/generateAuthenticationOptions/);
    expect(source).toMatch(/verifyAuthenticationResponse/);
    expect(source).toMatch(/userVerification:\s*['"]required['"]/);
    expect(source).toMatch(/requireUserVerification:\s*true/);
    expect(source).toMatch(/if \(!verification\.verified\)[\s\S]*webauthn_verification_failed/i);
    expect(source).toMatch(/verification\.verified[\s\S]*grantSecurityStepUp/i);
  });

  it('uses five-minute single-use challenges and consumes a challenge on verification attempt', () => {
    const repository = read('_shared/repository.ts');
    expect(repository).toMatch(/5 \* 60 \* 1000/);
    expect(repository).toMatch(/security_webauthn_challenges/);
    expect(repository).toMatch(/consumeChallenge/);
    expect(repository).toMatch(/verification_attempted_at/);
    expect(repository).toMatch(/consumed_at/);
    expect(repository).toMatch(/\.is\(['"]consumed_at['"],\s*null\)/i);
  });

  it('stores verified public credential material and updates counters only after successful authentication', () => {
    const repository = read('_shared/repository.ts');
    const webauthn = read('_shared/webauthn.ts');
    expect(repository).toMatch(/security_passkeys/);
    expect(repository).toMatch(/credential_public_key/);
    expect(repository).not.toMatch(/private_key/i);
    expect(webauthn).toMatch(/verification\.verified[\s\S]*updatePasskeyCounter/i);
  });

  it('exposes only the approved WebAuthn operation router with stable errors', () => {
    const source = read('index.ts');
    for (const operation of [
      'passkeys.registration.options',
      'passkeys.registration.verify',
      'passkeys.authentication.options',
      'passkeys.authentication.verify'
    ]) {
      expect(source).toContain(`'${operation}'`);
    }
    const errors = read('_shared/errors.ts');
    expect(errors).toContain('webauthn_not_configured');
    expect(errors).toContain('webauthn_verification_failed');
    expect(errors).toContain('authentication_required');
    expect(errors).toContain('active_organization_required');
  });
});
