import { describe, expect, it } from 'vitest';
import {
  approvalMatchesAction,
  digestConnectedAppAction,
  evaluateConnectedAppAccess,
  sanitizeConnectedAppMetadata
} from '../../supabase/functions/_shared/connected-apps/access';
import type { ProviderManifest } from '../../packages/connected-apps/src';

const manifest: ProviderManifest = {
  providerId: 'example', displayName: 'Example', authKinds: ['oauth2'], runtimeStatus: 'ready', adapterVersion: 1,
  supportsReadinessProbe: true, supportsTokenRefresh: true, supportsDisconnect: true, supportsDeletionRequest: false,
  capabilities: [
    { code: 'mail.read', accessLevel: 'read', providerScopes: ['mail.read'] },
    { code: 'mail.send', accessLevel: 'consequential', providerScopes: ['mail.send'] }
  ]
};

function context(overrides: Record<string, unknown> = {}) {
  return {
    actorPermission: true,
    activeMembership: true,
    organizationId: 'org-a',
    connectionOrganizationId: 'org-a',
    connectionState: 'connected',
    authorized: true,
    providerVerified: true,
    grantedScopes: ['mail.read', 'mail.send'],
    manifest,
    capabilityCode: 'mail.read',
    actorKind: 'user' as const,
    policies: [],
    owningModulePermission: true,
    ...overrides
  };
}

describe('Connected Apps access engine', () => {
  it('fails closed in gate order for organization scope and permissions', async () => {
    expect((await evaluateConnectedAppAccess(context({ activeMembership: false }))).reason).toBe('permission_denied');
    expect((await evaluateConnectedAppAccess(context({ actorPermission: false }))).reason).toBe('permission_denied');
    expect((await evaluateConnectedAppAccess(context({ connectionOrganizationId: 'org-b' }))).reason).toBe('organization_mismatch');
  });

  it('does not treat connected as sufficient when a scope is missing', async () => {
    const result = await evaluateConnectedAppAccess(context({ capabilityCode: 'mail.send', grantedScopes: ['mail.read'] }));
    expect(result.reason).toBe('scope_missing');
    expect(result.effect).toBe('deny');
  });

  it('requires approval by default for consequential capabilities', async () => {
    const result = await evaluateConnectedAppAccess(context({ capabilityCode: 'mail.send' }));
    expect(result.effect).toBe('approval_required');
  });

  it('binds approval to the exact canonical action digest', async () => {
    const first = await digestConnectedAppAction({ capability: 'mail.send', payload: { to: 'a@example.com', body: 'one' } });
    const same = await digestConnectedAppAction({ payload: { body: 'one', to: 'a@example.com' }, capability: 'mail.send' });
    const changed = await digestConnectedAppAction({ capability: 'mail.send', payload: { to: 'a@example.com', body: 'two' } });
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(same).toBe(first);
    expect(changed).not.toBe(first);
    expect(approvalMatchesAction({ status: 'approved', payloadDigest: first, expiresAt: null }, first, Date.now())).toBe(true);
    expect(approvalMatchesAction({ status: 'approved', payloadDigest: first, expiresAt: null }, changed, Date.now())).toBe(false);
  });

  it('redacts secret-bearing metadata recursively', () => {
    const safe = sanitizeConnectedAppMetadata({
      account: 'safe', access_token: 'top-secret', nested: { Authorization: 'Bearer private', ok: 1 }
    });
    expect(JSON.stringify(safe)).toContain('safe');
    expect(JSON.stringify(safe)).not.toContain('top-secret');
    expect(JSON.stringify(safe)).not.toContain('Bearer private');
  });
});
