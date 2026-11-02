import { describe, expect, it } from 'vitest';
import { authorizeDocumentRead, type DataRoomReadContext } from '../../packages/security/secure-data-room-policy';

/**
 * ATLAS Secure Data Room 777 — negative-first authorization contract.
 * These tests deliberately fail closed until a real authorization adapter is wired.
 * No production secrets, network, database, or privileged credentials are required.
 */
const valid: DataRoomReadContext = {
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
  it('denies missing context', () => {
    expect(authorizeDocumentRead(null)).toBe(false);
    expect(authorizeDocumentRead(undefined)).toBe(false);
  });

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
