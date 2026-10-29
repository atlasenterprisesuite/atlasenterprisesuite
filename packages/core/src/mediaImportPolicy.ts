export type MediaImportScope = 'private' | 'organization';
export type MediaImportRequest = {
  authenticatedUserId?: string | null;
  destinationOwnerId?: string | null;
  destinationOrganizationId?: string | null;
  effectiveOrganizationMember?: boolean;
  membershipRevoked?: boolean;
  sessionExpired?: boolean;
  explicitSharedDestination?: boolean;
  scope: MediaImportScope;
  fileName: string;
  byteSize: number;
  mimeType: string;
};
export type MediaImportDecision = { allowed: true; scope: MediaImportScope } | { allowed: false; reason: string };
const MAX_BYTES = 100 * 1024 * 1024;
const SAFE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'application/pdf', 'text/plain']);
/** Preliminary local gate only. Never substitutes for server authorization, content sniffing, RLS or storage policy. */
export function evaluateMediaImport(request: MediaImportRequest): MediaImportDecision {
  if (!request.authenticatedUserId || request.sessionExpired) return { allowed: false, reason: 'authentication_required' };
  if (!request.fileName || request.fileName.includes('/') || request.fileName.includes('\\') || request.fileName.includes('..') || /[\x00-\x1f]/.test(request.fileName)) return { allowed: false, reason: 'invalid_filename' };
  if (!Number.isSafeInteger(request.byteSize) || request.byteSize < 1 || request.byteSize > MAX_BYTES || !SAFE_MIME.has(request.mimeType)) return { allowed: false, reason: 'unsupported_file' };
  if (request.scope === 'private') {
    return request.destinationOwnerId === request.authenticatedUserId
      ? { allowed: true, scope: 'private' }
      : { allowed: false, reason: 'owner_mismatch' };
  }
  if (request.scope === 'organization') {
    if (!request.destinationOrganizationId || !request.explicitSharedDestination || !request.effectiveOrganizationMember || request.membershipRevoked)
      return { allowed: false, reason: 'organization_access_denied' };
    return { allowed: true, scope: 'organization' };
  }
  return { allowed: false, reason: 'invalid_scope' };
}
