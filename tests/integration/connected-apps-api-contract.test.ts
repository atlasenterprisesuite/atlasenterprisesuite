import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const oauthPath = 'supabase/functions/atlas-integration-oauth/index.ts';
const gatewayPath = 'supabase/functions/atlas-integrations/index.ts';
const repositoryPath = 'supabase/functions/_shared/integrations/repository.ts';
const oauthReturnMigrationPath = 'supabase/migrations/20260915163000_connected_apps_oauth_return_path.sql';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

describe('Connected Apps OAuth contract', () => {
  it('uses explicit start/callback actions, PKCE, hashed state and a ten-minute transaction', () => {
    const oauth = source(oauthPath);
    expect(oauth).toContain("'start'");
    expect(oauth).toContain("'callback'");
    expect(oauth).toContain('codeChallenge');
    expect(oauth).toContain('sha256Base64Url');
    expect(oauth).toMatch(/10\s*\*\s*60\s*\*\s*1000/);
    expect(oauth).toContain('code_verifier_credential_ref');
  });

  it('requires bearer authentication for OAuth start but permits provider callback through one-time state', () => {
    const oauth = source(oauthPath);
    expect(oauth).toContain('resolveIntegrationContext');
    expect(oauth).toContain("action === 'start'");
    expect(oauth).toContain("action === 'callback'");
    expect(oauth).toContain('consumed_at');
    expect(oauth).toContain('expires_at');
    expect(oauth).toContain('user_id');
    expect(oauth).toContain('org_id');
  });

  it('redirects with sanitized OAuth status only and never returns provider secrets', () => {
    const oauth = source(oauthPath);
    expect(oauth).toContain("status: 'success' | 'cancelled' | 'error'");
    expect(oauth).toContain("target.searchParams.set('oauth', status)");
    expect(oauth).toContain("redirectTo(returnTo, 'success')");
    expect(oauth).toContain("'cancelled'");
    expect(oauth).toContain("redirectTo(returnTo, 'error'");
    expect(oauth).not.toMatch(/searchParams\.set\(['"](?:code|access_token|refresh_token|client_secret|code_verifier)['"]/i);
  });

  it('stores only an internal safe return path in the OAuth state row', () => {
    const migration = source(oauthReturnMigrationPath);
    expect(migration).toContain('return_to');
    expect(migration).toMatch(/return_to[\s\S]*check/i);
  });

  it('redirects success only after the verified state is durably persisted', () => {
    const oauth = source(oauthPath);
    expect(oauth).toContain('const verifiedConnection = await updateConnection');
    expect(oauth).toContain("if (!verifiedConnection) throw integrationError('connection_update_failed', 500)");
    expect(oauth.indexOf("if (!verifiedConnection) throw integrationError('connection_update_failed', 500)")).toBeLessThan(
      oauth.indexOf("redirectTo(returnTo, 'success')")
    );
  });
});

describe('Connected Apps Integration Gateway contract', () => {
  it('has an explicit operation allow-list and resolves authenticated ATLAS context', () => {
    const gateway = source(gatewayPath);
    for (const action of ['connections', 'connection', 'verify', 'execute', 'revoke', 'grants', 'grant', 'revoke-grant', 'audit']) {
      expect(gateway).toContain(`'${action}'`);
    }
    expect(gateway).toContain('resolveIntegrationContext');
  });

  it('marks verified only after the Microsoft provider verification call succeeds and persistence succeeds', () => {
    const gateway = source(gatewayPath);
    const verifyCall = gateway.indexOf('adapter.verify');
    const verifiedUpdate = gateway.indexOf("state: 'verified'");
    expect(verifyCall).toBeGreaterThan(-1);
    expect(verifiedUpdate).toBeGreaterThan(verifyCall);
    expect(gateway).toContain("if (!updated) throw integrationError('connection_update_failed', 500)");
    expect(gateway).not.toContain("safeConnection(updated || { ...row, state: 'verified'");
  });

  it('evaluates shared capability policy before provider execution', () => {
    const gateway = source(gatewayPath);
    const policy = gateway.indexOf('evaluateCapabilityRequest');
    const execute = gateway.indexOf('adapter.executeCapability');
    expect(policy).toBeGreaterThan(-1);
    expect(execute).toBeGreaterThan(policy);
  });

  it('requires a real active grant and validates provider scopes before creating a grant', () => {
    const gateway = source(gatewayPath);
    expect(gateway).toContain('requiredProviderScopes');
    expect(gateway).toContain('createIntegrationGrant');
    expect(gateway).toContain('revokeIntegrationGrant');
    expect(gateway).toContain("requirePermission(context, 'integrations.manage')");
    expect(gateway).toContain('integration_provider_scope_missing');
  });

  it('exposes tenant-scoped grants and metadata-only activity through repository methods', () => {
    const repository = source(repositoryPath);
    for (const method of ['listGrants', 'createIntegrationGrant', 'revokeIntegrationGrant', 'listIntegrationEvents']) {
      expect(repository).toContain(`function ${method}`);
    }
    expect(repository).toContain('atlas_integration_grants');
    expect(repository).toContain('atlas_integration_events');
  });

  it('refreshes once, preserves scopes when Microsoft omits them, and verifies before retrying', () => {
    const gateway = source(gatewayPath);
    expect(gateway).toContain('refreshMicrosoftCredential');
    expect(gateway).toContain('adapter.refresh');
    expect(gateway).toContain('adapter.verify');
    expect(gateway).toContain("fresh.scopes.length ? fresh.scopes : tokens.scopes");
    expect(gateway).toContain("state: 'reconnect_required'");
  });

  it('revokes local credential use only after revoked state is durably persisted', () => {
    const gateway = source(gatewayPath);
    const revokeStart = gateway.indexOf('async function handleRevoke(');
    expect(revokeStart).toBeGreaterThan(-1);
    const revokeHandler = gateway.slice(revokeStart);
    const persistRevoked = revokeHandler.indexOf("state: 'revoked'");
    const requirePersistedUpdate = revokeHandler.indexOf("if (!updated) throw integrationError('connection_update_failed', 500)");
    const deleteCredential = revokeHandler.indexOf('deleteCredentialRecord');
    expect(persistRevoked).toBeGreaterThan(-1);
    expect(requirePersistedUpdate).toBeGreaterThan(persistRevoked);
    expect(deleteCredential).toBeGreaterThan(requirePersistedUpdate);
    expect(revokeHandler).toContain('providerManagementUrl');
    expect(revokeHandler).not.toContain("safeConnection(updated || { ...row, state: 'revoked'");
  });

  it('repository supports one-time OAuth state and Microsoft connection upsert on canonical tables', () => {
    const repository = source(repositoryPath);
    expect(repository).toContain('createOAuthState');
    expect(repository).toContain('findOAuthStateByHash');
    expect(repository).toContain('consumeOAuthState');
    expect(repository).toContain('upsertMicrosoftConnection');
    expect(repository).toContain('atlas_oauth_states');
    expect(repository).toContain('atlas_integration_connections');
  });
});
