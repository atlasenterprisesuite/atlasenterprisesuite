import { describe, expect, it } from 'vitest';
import { evaluateMediaImport, type MediaImportRequest } from '../../packages/core/src/mediaImportPolicy';
const base: MediaImportRequest = {
  authenticatedUserId: 'user-a', destinationOwnerId: 'user-a', scope: 'private',
  fileName: 'photo.jpg', byteSize: 1024, mimeType: 'image/jpeg'
};
describe('Media import preliminary fail-closed policy', () => {
  it('permits explicitly owned private imports', () => {
    expect(evaluateMediaImport(base)).toEqual({ allowed: true, scope: 'private' });
  });
  it.each([
    [{ authenticatedUserId: null }, 'authentication_required'],
    [{ sessionExpired: true }, 'authentication_required'],
    [{ destinationOwnerId: 'user-b' }, 'owner_mismatch'],
    [{ fileName: '../photo.jpg' }, 'invalid_filename'],
    [{ fileName: 'folder/photo.jpg' }, 'invalid_filename'],
    [{ byteSize: 0 }, 'unsupported_file'],
    [{ byteSize: 100 * 1024 * 1024 + 1 }, 'unsupported_file'],
    [{ mimeType: 'text/html' }, 'unsupported_file'],
  ] as const)('rejects unsafe private imports %#', (change, reason) => {
    expect(evaluateMediaImport({ ...base, ...change })).toEqual({ allowed: false, reason });
  });
  it('requires explicit organization selection and current membership', () => {
    const org: MediaImportRequest = { ...base, scope: 'organization', destinationOrganizationId: 'org-a', explicitSharedDestination: true, effectiveOrganizationMember: true };
    expect(evaluateMediaImport(org)).toEqual({ allowed: true, scope: 'organization' });
    for (const change of [{ explicitSharedDestination: false }, { effectiveOrganizationMember: false }, { membershipRevoked: true }, { destinationOrganizationId: null }]) {
      expect(evaluateMediaImport({ ...org, ...change })).toEqual({ allowed: false, reason: 'organization_access_denied' });
    }
  });
});
