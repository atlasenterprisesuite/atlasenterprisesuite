import { describe, expect, it } from 'vitest';

/**
 * ATLAS Secure Data Room 777 — negative-first authorization contract.
 * These tests deliberately fail closed until a real authorization adapter is wired.
 * No production secrets, network, database, or privileged credentials are required.
 */
type DecisionInput = {
  actorId: string;
  tenantId: string;
  organizationId: string;
  documentTenantId: string;
  documentOrganizationId: string;
  membershipActive: boolean;
  sessionActive: boolean;
  grantActive: boolean;
  documentRevoked: boolean;
};

export function authorizeDocumentRead(input: DecisionInput): boolean {
  return Boolean(
    input.actorId &&
    input.tenantId &&
    input.organizationId &&
    input.documentTenantId === input.tenantId &&
    input.documentOrganizationId === input.organizationId &&
    input.membershipActive &&
    input.sessionActive &&
    input.grantActive &&
    !input.documentRevoked
  );
}

const valid: DecisionInput = {
  actorId: 'user-a',
  tenantId: 'tenant-a',
  organizationId: 'org-a',
  documentTenantId: 'tenant-a',
  documentOrganizationId: 'org-a',
  membershipActive: true,
  sessionActive: true,
  grantActive: true,
  documentRevoked: false
};

describe('Secure Data Room 777: fail-closed policy contract', () => {
  it('allows a fully scoped, active authorization decision', () => {
    expect(authorizeDocumentRead(valid)).toBe(true);
  });

  it.each([
    ['cross-tenant', { documentTenantId: 'tenant-b' }],
    ['cross-organization', { documentOrganizationId: 'org-b' }],
    ['removed membership', { membershipActive: false }],
    ['revoked session', { sessionActive: false }],
    ['revoked grant', { grantActive: false }],
    ['revoked document', { documentRevoked: true }],
    ['missing actor', { actorId: '' }],
    ['missing tenant', { tenantId: '' }],
    ['missing organization', { organizationId: '' }]
  ])('denies %s', (_case, change) => {
    expect(authorizeDocumentRead({ ...valid, ...change })).toBe(false);
  });
});
