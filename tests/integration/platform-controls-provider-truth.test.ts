import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-platform-controls/index.ts', 'utf8');

describe('ATLAS platform controls provider truth boundary', () => {
  it('supports the canonical modern auth kinds used by external adapters', () => {
    for (const kind of [
      'oauth2',
      'oidc',
      'api_key',
      'service_token',
      'service_jwt',
      'signed_token',
      'opaque_reference',
      'password'
    ]) {
      expect(source).toContain(`'${kind}'`);
    }
  });

  it('reads existing connection truth before applying browser configuration changes', () => {
    expect(source).toContain(".from('atlas_integration_connections')");
    expect(source).toContain(".select('id,auth_kind,endpoint_origin,authorized,provider_verified,state,secret_ref,created_by,last_verified_at,last_success_at')");
    expect(source).toContain('configurationChanged');
    expect(source).toContain('existing?.provider_verified === true');
  });

  it('never copies provider verification or connected state directly from client input', () => {
    expect(source).not.toContain('provider_verified: Boolean(v.provider_verified)');
    expect(source).not.toContain("state: v.state || 'unconfigured'");
    expect(source).toContain('provider_verified: providerVerified');
    expect(source).toContain('state: derivedState');
    expect(source).toContain("requested_state_ignored: Boolean(v.state)");
  });

  it('invalidates provider verification when verification-relevant configuration changes', () => {
    expect(source).toContain('const providerVerified = existing?.provider_verified === true && !configurationChanged;');
    expect(source).toContain("const derivedState = providerVerified && authorized && existing?.state === 'connected'");
    expect(source).toContain("? 'connected'");
    expect(source).toContain("authorized ? 'authorizing' : 'unconfigured'");
    expect(source).toContain('last_verified_at: providerVerified ? existing?.last_verified_at ?? null : null');
    expect(source).toContain('last_success_at: providerVerified ? existing?.last_success_at ?? null : null');
  });
});
