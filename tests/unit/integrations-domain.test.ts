import { describe, expect, it } from 'vitest';
import {
  evaluateCapabilityRequest,
  providerDefinitionFor,
  requireIntegrationPermission,
  type IntegrationActorContext,
  type IntegrationConnection
} from '../../packages/integrations';

const actor: IntegrationActorContext = {
  tenantId: 'org-1',
  organizationId: 'org-1',
  userId: 'user-1',
  role: 'owner',
  permissions: ['integrations.view', 'integrations.use', 'integrations.manage']
};

const connection: IntegrationConnection = {
  id: 'conn-1',
  tenantId: 'org-1',
  organizationId: 'org-1',
  userId: 'user-1',
  providerKey: 'microsoft',
  connectorClass: 'user_oauth',
  environment: null,
  status: 'verified',
  grantedScopes: ['User.Read'],
  maskedIdentity: 'w***u@example.com',
  lastVerifiedAt: '2026-09-12T12:00:00.000Z'
};

describe('integration gateway policy', () => {
  it('fails closed across organization scope', () => {
    expect(() => evaluateCapabilityRequest({
      actor: { ...actor, organizationId: 'org-2', tenantId: 'org-2' },
      connection,
      grant: {
        connectionId: 'conn-1',
        principalType: 'user',
        principalId: 'user-1',
        module: 'settings',
        capability: 'microsoft.profile.read'
      },
      request: { module: 'settings', capability: 'microsoft.profile.read' }
    })).toThrow('integration_scope_mismatch');
  });

  it('requires verified state, grant, ATLAS permission, and provider scope', () => {
    const decision = evaluateCapabilityRequest({
      actor,
      connection,
      grant: {
        connectionId: 'conn-1',
        principalType: 'user',
        principalId: 'user-1',
        module: 'settings',
        capability: 'microsoft.profile.read'
      },
      request: { module: 'settings', capability: 'microsoft.profile.read' }
    });
    expect(decision).toEqual({ allowed: true });
  });

  it('does not treat connected_unverified as executable', () => {
    expect(() => evaluateCapabilityRequest({
      actor,
      connection: { ...connection, status: 'connected_unverified' },
      grant: {
        connectionId: 'conn-1',
        principalType: 'user',
        principalId: 'user-1',
        module: 'settings',
        capability: 'microsoft.profile.read'
      },
      request: { module: 'settings', capability: 'microsoft.profile.read' }
    })).toThrow('integration_not_verified');
  });

  it('registers Microsoft without provider secrets', () => {
    expect(providerDefinitionFor('microsoft')).toMatchObject({ connectorClass: 'user_oauth' });
    expect(JSON.stringify(providerDefinitionFor('microsoft'))).not.toMatch(/client_secret|access_token|refresh_token/i);
  });

  it('separates infrastructure management permission', () => {
    expect(() => requireIntegrationPermission(actor, 'infrastructure.integrations.manage')).toThrow('authorization_denied');
  });
});
