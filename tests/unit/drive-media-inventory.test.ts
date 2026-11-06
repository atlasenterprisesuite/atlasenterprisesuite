import { describe, expect, it } from 'vitest';
import {
  groupDriveMediaByHash,
  readDriveMedia,
  registerDriveMedia
} from '../../packages/core/src/driveMediaInventory';

const tenantA = { tenantId: 'tenant-a', organizationId: 'org-a' };
const tenantB = { tenantId: 'tenant-b', organizationId: 'org-b' };
const owner = { scope: tenantA, permissions: ['integrations.read', 'integrations.write'] as const };
const readOnly = { scope: tenantA, permissions: ['integrations.read'] as const };
const noPermissions = { scope: tenantA, permissions: [] as const };
const foreign = { scope: tenantB, permissions: ['integrations.read', 'integrations.write'] as const };
const base = {
  scope: tenantA,
  driveFileId: 'synthetic_drive_id_a1',
  name: 'people.png',
  mimeType: 'image/png',
  sha256: 'a'.repeat(64),
  collection: 'production-covers' as const
};

describe('ATLAS Drive media inventory — tenant-scoped fail closed', () => {
  it('never publishes media or accepts unverified review claims', () => {
    const pending = registerDriveMedia(base, owner);
    expect(pending).toMatchObject({
      scope: tenantA,
      sensitivity: 'restricted',
      publishable: false,
      rightsStatus: 'unverified',
      reviewStatus: 'pending'
    });
    const untrustedClaims = { ...base, visualReviewed: true, permissionReviewed: true };
    const forgedClaims = registerDriveMedia(untrustedClaims, owner);
    expect(forgedClaims).toMatchObject({
      publishable: false,
      rightsStatus: 'unverified',
      reviewStatus: 'pending'
    });
  });

  it('rejects missing identity, wrong tenant, wrong organization and revoked write permissions', () => {
    expect(() => registerDriveMedia(base)).toThrow('MEDIA_ACCESS_DENIED');
    expect(() => registerDriveMedia(base, readOnly)).toThrow('MEDIA_ACCESS_DENIED');
    expect(() => registerDriveMedia(base, noPermissions)).toThrow('MEDIA_ACCESS_DENIED');
    expect(() => registerDriveMedia(base, foreign)).toThrow('MEDIA_ACCESS_DENIED');
    expect(() => registerDriveMedia({ ...base, scope: { tenantId: 'tenant-a', organizationId: 'org-b' } }, owner))
      .toThrow('MEDIA_ACCESS_DENIED');
    expect(() => registerDriveMedia({ ...base, scope: { tenantId: '', organizationId: 'org-a' } }, owner))
      .toThrow('INVALID_MEDIA_SCOPE');
  });

  it('never reveals source Drive IDs across tenants or after read permission revocation', () => {
    const one = registerDriveMedia(base, owner);
    expect(readDriveMedia(one, owner)?.driveFileId).toBe(base.driveFileId);
    expect(readDriveMedia(one, readOnly)?.driveFileId).toBe(base.driveFileId);
    expect(readDriveMedia(one, foreign)).toBeNull();
    expect(readDriveMedia(one, noPermissions)).toBeNull();
    expect(readDriveMedia(one)).toBeNull();
  });

  it('restricts anonymous library images to Studio, never public', () => {
    const result = registerDriveMedia({
      ...base, name: 'IMG_9010.jpeg', mimeType: 'image/jpeg', collection: 'chatgpt-library'
    }, owner);
    expect(result).toMatchObject({ sensitivity: 'restricted', moduleId: 'studio', publishable: false });
  });

  it('rejects invalid source identifiers, integrity and MIME type', () => {
    expect(() => registerDriveMedia({ ...base, sha256: 'unverified' }, owner)).toThrow('INVALID_SHA256');
    expect(() => registerDriveMedia({ ...base, driveFileId: '../bad' }, owner)).toThrow('INVALID_DRIVE_ID');
    expect(() => registerDriveMedia({ ...base, mimeType: 'text/html' }, owner)).toThrow('UNSUPPORTED_MEDIA_TYPE');
  });

  it('groups byte-identical records for authorized scope only, retaining its source IDs', () => {
    const one = registerDriveMedia(base, owner);
    const two = registerDriveMedia({ ...base, driveFileId: 'synthetic_drive_id_b2' }, owner);
    const otherTenant = registerDriveMedia({ ...base, scope: tenantB, driveFileId: 'synthetic_drive_id_c3' }, foreign);

    const grouped = groupDriveMediaByHash([one, two, otherTenant], owner);
    expect(grouped.size).toBe(1);
    expect(grouped.get(base.sha256)?.map(x => x.driveFileId)).toEqual([
      'synthetic_drive_id_a1',
      'synthetic_drive_id_b2'
    ]);

    expect(groupDriveMediaByHash([one, two, otherTenant], foreign).get(base.sha256)?.map(x => x.driveFileId))
      .toEqual(['synthetic_drive_id_c3']);
    expect(groupDriveMediaByHash([one, two, otherTenant], noPermissions).size).toBe(0);
    expect(groupDriveMediaByHash([one, two, otherTenant]).size).toBe(0);
  });
});
