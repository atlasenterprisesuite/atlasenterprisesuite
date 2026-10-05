import { describe, expect, it } from 'vitest';
import {
  canTransitionConnectedAppState,
  evaluateConnectedAppPolicy,
  normalizeConnectedAppError,
  requiredScopesForCapability,
  validateProviderManifest,
  type ConnectedAppAccessInput,
  type ConnectedAppPolicy,
  type ProviderManifest
} from '../../packages/connected-apps/src';

const manifest: ProviderManifest = {
  providerId: 'example',
  displayName: 'Example',
  authKinds: ['oauth2'],
  runtimeStatus: 'ready',
  capabilities: [
    { code: 'mail.read', accessLevel: 'read', providerScopes: ['mail.read'] },
    { code: 'mail.send', accessLevel: 'consequential', providerScopes: ['mail.send'] }
  ],
  supportsReadinessProbe: true,
  supportsTokenRefresh: true,
  supportsDisconnect: true,
  supportsDeletionRequest: false,
  adapterVersion: 1
};

const baseInput: ConnectedAppAccessInput = {
  capabilityCode: 'mail.read',
  accessLevel: 'read',
  actorKind: 'user',
  policies: []
};

describe('ATLAS Connected Apps domain', () => {
  it('accepts canonical lifecycle transitions and rejects unsafe jumps', () => {
    expect(canTransitionConnectedAppState('disconnected', 'authorizing')).toBe(true);
    expect(canTransitionConnectedAppState('authorizing', 'connected')).toBe(true);
    expect(canTransitionConnectedAppState('connected', 'degraded')).toBe(true);
    expect(canTransitionConnectedAppState('degraded', 'connected')).toBe(true);
    expect(canTransitionConnectedAppState('connected', 'revoked')).toBe(true);
    expect(canTransitionConnectedAppState('expired', 'authorizing')).toBe(true);
    expect(canTransitionConnectedAppState('connected', 'disconnected')).toBe(true);
    expect(canTransitionConnectedAppState('disconnected', 'connected')).toBe(false);
    expect(canTransitionConnectedAppState('revoked', 'connected')).toBe(false);
  });

  it('normalizes legacy unconfigured state to disconnected without changing canonical state names', () => {
    expect(canTransitionConnectedAppState('unconfigured' as never, 'authorizing')).toBe(true);
  });

  it('validates manifests and resolves provider-owned scopes', () => {
    expect(validateProviderManifest(manifest)).toEqual(manifest);
    expect(requiredScopesForCapability(manifest, 'mail.send')).toEqual(['mail.send']);
    expect(() => requiredScopesForCapability(manifest, 'unknown')).toThrow('capability_not_supported');
  });

  it('rejects duplicate capability codes in one provider manifest', () => {
    expect(() => validateProviderManifest({
      ...manifest,
      capabilities: [manifest.capabilities[0], manifest.capabilities[0]]
    })).toThrow('duplicate_capability');
  });

  it('enforces deny over approval over allow and defaults consequential actions to approval', () => {
    const allow: ConnectedAppPolicy = { capabilityPattern: 'mail.*', effect: 'allow', actorKind: 'any', enabled: true };
    const approval: ConnectedAppPolicy = { capabilityPattern: 'mail.send', effect: 'approval_required', actorKind: 'any', enabled: true };
    const deny: ConnectedAppPolicy = { capabilityPattern: 'mail.send', effect: 'deny', actorKind: 'agent', enabled: true };

    expect(evaluateConnectedAppPolicy({ ...baseInput, policies: [allow] }).effect).toBe('allow');
    expect(evaluateConnectedAppPolicy({ ...baseInput, capabilityCode: 'mail.send', accessLevel: 'consequential', policies: [] }).effect).toBe('approval_required');
    expect(evaluateConnectedAppPolicy({ ...baseInput, capabilityCode: 'mail.send', accessLevel: 'consequential', policies: [allow, approval] }).effect).toBe('approval_required');
    expect(evaluateConnectedAppPolicy({ ...baseInput, capabilityCode: 'mail.send', accessLevel: 'consequential', actorKind: 'agent', policies: [allow, approval, deny] }).effect).toBe('deny');
  });

  it('sanitizes secret-bearing and arbitrary provider errors into safe categories', () => {
    const normalized = normalizeConnectedAppError(new Error('Authorization: Bearer secret-token provider exploded'));
    expect(normalized.code).toBe('provider_request_failed');
    expect(normalized.message).not.toContain('secret-token');
    expect(normalized.message).not.toContain('Authorization');
  });
});
