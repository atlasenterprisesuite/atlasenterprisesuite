import { describe, expect, it } from 'vitest';
import { groupDriveMediaByHash, registerDriveMedia } from '../../packages/core/src/driveMediaInventory';

const base = {
  driveFileId: '1YOjIEUJ5Nx61HLqHu3dyvwkKDo3P79wj',
  name: 'people.png',
  mimeType: 'image/png',
  sha256: 'a'.repeat(64),
  collection: 'production-covers' as const
};

describe('ATLAS Drive media inventory — fail closed', () => {
  it('does not publish unreviewed or even reviewed media automatically', () => {
    const pending = registerDriveMedia(base);
    expect(pending).toMatchObject({ sensitivity: 'restricted', publishable: false, reviewStatus: 'pending' });
    const reviewed = registerDriveMedia({ ...base, visualReviewed: true, permissionReviewed: true });
    expect(reviewed).toMatchObject({ publishable: false, reviewStatus: 'reviewed' });
  });
  it('never treats anonymous ChatGPT images as public', () => {
    expect(registerDriveMedia({ ...base, name: 'IMG_9010.jpeg', mimeType: 'image/jpeg', collection: 'chatgpt-library' }))
      .toMatchObject({ sensitivity: 'restricted', moduleId: 'studio' });
  });
  it('rejects missing integrity or invalid identifiers', () => {
    expect(() => registerDriveMedia({ ...base, sha256: 'unverified' })).toThrow('INVALID_SHA256');
    expect(() => registerDriveMedia({ ...base, driveFileId: '../bad' })).toThrow('INVALID_DRIVE_ID');
    expect(() => registerDriveMedia({ ...base, mimeType: 'text/html' })).toThrow('UNSUPPORTED_MEDIA_TYPE');
  });
  it('groups exact hashes without losing original file references', () => {
    const one = registerDriveMedia(base);
    const two = registerDriveMedia({ ...base, driveFileId: '1oll7hp2_jI8IVFb0m2XYdiWsgNw1Qt_V', name: 'IMG_9010.jpeg' });
    const grouped = groupDriveMediaByHash([one, two]);
    expect(grouped.size).toBe(1);
    expect(grouped.get(base.sha256)?.map((x) => x.driveFileId)).toHaveLength(2);
  });
});
