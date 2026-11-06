import { classifyAtlasLibraryAsset } from './libraryRouting';

export type DriveMediaInput = {
  driveFileId: string;
  name: string;
  mimeType: string;
  sha256: string;
  collection: 'production-covers' | 'chatgpt-library';
  visualReviewed?: boolean;
  permissionReviewed?: boolean;
};

export type DriveMediaRecord = {
  driveFileId: string;
  name: string;
  sha256: string;
  moduleId: string;
  sensitivity: 'restricted' | 'organization';
  publishable: false;
  reviewStatus: 'pending' | 'reviewed';
};

/** Metadata-only catalog: never fetches, copies or publishes source media. */
export function registerDriveMedia(input: DriveMediaInput): DriveMediaRecord {
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(input.driveFileId)) throw new Error('INVALID_DRIVE_ID');
  if (!/^[a-f0-9]{64}$/i.test(input.sha256)) throw new Error('INVALID_SHA256');
  if (!/^image\/(png|jpeg|webp)$/.test(input.mimeType)) throw new Error('UNSUPPORTED_MEDIA_TYPE');
  if (!input.name.trim()) throw new Error('INVALID_MEDIA_NAME');

  const classification = classifyAtlasLibraryAsset({
    name: input.name, mimeType: input.mimeType
  });
  // Metadata cannot prove privacy, rights or publication authorization.
  return {
    driveFileId: input.driveFileId,
    name: input.name,
    sha256: input.sha256.toLowerCase(),
    moduleId: input.collection === 'production-covers' ? classification.primaryModuleId : 'studio',
    sensitivity: 'restricted',
    publishable: false,
    reviewStatus: input.visualReviewed && input.permissionReviewed ? 'reviewed' : 'pending'
  };
}

/** Preserve every original Drive ID while grouping byte-identical content. */
export function groupDriveMediaByHash(records: readonly DriveMediaRecord[]): Map<string, DriveMediaRecord[]> {
  const grouped = new Map<string, DriveMediaRecord[]>();
  for (const record of records) {
    const group = grouped.get(record.sha256) ?? [];
    group.push(record);
    grouped.set(record.sha256, group);
  }
  return grouped;
}
