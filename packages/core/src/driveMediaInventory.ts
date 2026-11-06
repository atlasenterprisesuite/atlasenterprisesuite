import { classifyAtlasLibraryAsset } from './libraryRouting';
import { authorize, type AuthorizationContext } from './permissions';
import type { TenantScope } from './scope';

export type DriveMediaInput = {
  scope: TenantScope;
  driveFileId: string;
  name: string;
  mimeType: string;
  sha256: string;
  collection: 'production-covers' | 'chatgpt-library';
};

export type DriveMediaRecord = {
  scope: TenantScope;
  driveFileId: string;
  name: string;
  sha256: string;
  moduleId: string;
  sensitivity: 'restricted';
  publishable: false;
  reviewStatus: 'pending';
  rightsStatus: 'unverified';
};

function hasValidScope(scope: TenantScope | null | undefined): scope is TenantScope {
  return Boolean(
    scope &&
    typeof scope.tenantId === 'string' &&
    scope.tenantId.trim() &&
    typeof scope.organizationId === 'string' &&
    scope.organizationId.trim()
  );
}

function hasMediaAccess(
  actor: AuthorizationContext | null | undefined,
  scope: TenantScope,
  permission: 'integrations.read' | 'integrations.write'
): boolean {
  return Boolean(
    actor &&
    hasValidScope(actor.scope) &&
    hasValidScope(scope) &&
    authorize(actor, { scope, permission }).ok
  );
}

/**
 * Register metadata only. The actor MUST come from a trusted server-side identity,
 * never an unverified request body. This function never copies or publishes media.
 */
export function registerDriveMedia(input: DriveMediaInput, actor?: AuthorizationContext | null): DriveMediaRecord {
  if (!hasValidScope(input.scope)) throw new Error('INVALID_MEDIA_SCOPE');
  if (!hasMediaAccess(actor, input.scope, 'integrations.write')) throw new Error('MEDIA_ACCESS_DENIED');
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(input.driveFileId)) throw new Error('INVALID_DRIVE_ID');
  if (!/^[a-f0-9]{64}$/i.test(input.sha256)) throw new Error('INVALID_SHA256');
  if (!/^image\/(png|jpeg|webp)$/.test(input.mimeType)) throw new Error('UNSUPPORTED_MEDIA_TYPE');
  if (!input.name.trim()) throw new Error('INVALID_MEDIA_NAME');

  const classification = classifyAtlasLibraryAsset({
    name: input.name, mimeType: input.mimeType
  });

  // Flags or claims supplied by the caller cannot constitute independent rights or privacy evidence.
  return {
    scope: { tenantId: input.scope.tenantId, organizationId: input.scope.organizationId },
    driveFileId: input.driveFileId,
    name: input.name,
    sha256: input.sha256.toLowerCase(),
    moduleId: input.collection === 'production-covers' ? classification.primaryModuleId : 'studio',
    sensitivity: 'restricted',
    publishable: false,
    reviewStatus: 'pending',
    rightsStatus: 'unverified'
  };
}

/** Never disclose Drive IDs or metadata to an actor outside the record's tenant and organization. */
export function readDriveMedia(
  record: DriveMediaRecord,
  actor?: AuthorizationContext | null
): DriveMediaRecord | null {
  return hasMediaAccess(actor, record.scope, 'integrations.read') ? record : null;
}

/** Group only records visible to an authorized actor; never correlate content across tenants. */
export function groupDriveMediaByHash(
  records: readonly DriveMediaRecord[],
  actor?: AuthorizationContext | null
): Map<string, DriveMediaRecord[]> {
  const grouped = new Map<string, DriveMediaRecord[]>();
  for (const record of records) {
    if (!readDriveMedia(record, actor)) continue;
    const group = grouped.get(record.sha256) ?? [];
    group.push(record);
    grouped.set(record.sha256, group);
  }
  return grouped;
}
