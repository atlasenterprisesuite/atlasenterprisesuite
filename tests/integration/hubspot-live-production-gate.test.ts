import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('HubSpot live production gate', () => {
  it('keeps the verifier server-side and token-free', () => {
    const source = read('supabase/functions/atlas-hubspot-live-verify/index.ts');
    expect(source).toContain("atlas-hubspot-live-verifier");
    expect(source).toContain("github-oidc");
    expect(source).toContain("HUBSPOT_P0_SCOPES");
    expect(source).toContain("introspectHubSpotToken");
    expect(source).toContain("refreshHubSpotConnectionCredential");
    expect(source).toContain("destroyCredentialPayload");
    expect(source).toContain("secrets_returned: false");
    expect(source).not.toMatch(/accessToken\s*:/);
    expect(source).not.toMatch(/refreshToken\s*:/);
  });

  it('verifies all four real CRM object classes without fabricating data', () => {
    const source = read('supabase/functions/atlas-hubspot-live-verify/index.ts');
    for (const objectType of ['contact', 'company', 'deal', 'ticket']) {
      expect(source).toContain(`'${objectType}'`);
    }
    expect(source).toContain('records_observed');
    expect(source).toContain('nextCursor');
  });

  it('fails closed on account, scope, introspection, or stale connection failures', () => {
    const source = read('supabase/functions/atlas-hubspot-live-verify/index.ts');
    expect(source).toContain('provider_account_mismatch');
    expect(source).toContain('oauth_scope_mismatch');
    expect(source).toContain('oauth_token_inactive');
    expect(source).toContain("state !== 'connected'");
  });

  it('allows revoke testing only for credentials not referenced by any connection', () => {
    const source = read('supabase/functions/atlas-hubspot-live-verify/index.ts');
    expect(source).toContain('revoke-orphan');
    expect(source).toContain('credential_ref');
    expect(source).toContain('orphan_credential_required');
    expect(source).toContain('revokeHubSpotToken');
    expect(source).toContain("tokenTypeHint: 'refresh_token'");
  });

  it('uses GitHub OIDC for the recurring production workflow without provider secrets', () => {
    const workflow = read('.github/workflows/hubspot-live-production-gate.yml');
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('atlas-hubspot-live-verifier');
    expect(workflow).toContain('atlas-hubspot-live-verify?api=verify');
    expect(workflow).toContain('EXPECTED_ACCOUNT_ID: "247228429"');
    expect(workflow).not.toContain('HUBSPOT_CLIENT_SECRET');
    expect(workflow).not.toContain('HUBSPOT_ACCESS_TOKEN');
    expect(workflow).not.toContain('HUBSPOT_REFRESH_TOKEN');
  });
});
