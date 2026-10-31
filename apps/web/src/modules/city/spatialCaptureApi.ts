import { atlasAuthorizedJson, authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';
import { captureFilesToMetadata, validateCaptureSession } from './spatialCaptureSession';

export type SpatialCaptureReceipt = {
  sessionId: string; photoId: string; sha256Client: string; objectPath: string;
  integrityState: 'client_claim_unverified';
};
const BUCKET = 'atlas-spatial-captures';
const MIME = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif']);

export async function sha256OfFile(file: File): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('secure_crypto_unavailable');
  const result = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(result), b => b.toString(16).padStart(2, '0')).join('');
}

export async function captureSpatialPhotos(
  entityId: string, files: readonly File[], consent: boolean, siteAuthorized: boolean
): Promise<SpatialCaptureReceipt[]> {
  const org = await getActiveAtlasOrganization();
  const checked = validateCaptureSession({
    organizationId: org.id, siteId: entityId,
    consentToCapture: consent, authorizedBySiteOwner: siteAuthorized,
    images: captureFilesToMetadata(files)
  });
  if (!checked.ok) throw new Error(checked.reason);
  if (!crypto.randomUUID) throw new Error('secure_uuid_unavailable');
  const sessionId = crypto.randomUUID();
  await atlasAuthorizedJson('/rest/v1/atlas_spatial_capture_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: sessionId, org_id: org.id, entity_id: entityId,
      consent_recorded: true, site_authorized: true
    })
  });
  const receipts: SpatialCaptureReceipt[] = [];
  for (const file of files) {
    if (!MIME.has(file.type.toLowerCase())) throw new Error('unsupported_image');
    const photoId = crypto.randomUUID();
    const objectPath = `${org.id}/${sessionId}/${photoId}`;
    const hash = await sha256OfFile(file);
    const response = await authorizedAtlasFetch(
      `/storage/v1/object/${BUCKET}/${objectPath}`,
      { method: 'POST', headers: { 'content-type': file.type, 'x-upsert': 'false' }, body: file }
    );
    if (!response.ok) throw new Error(`private_storage_upload_failed_${response.status}`);
    await atlasAuthorizedJson('/rest/v1/atlas_spatial_capture_photos', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: photoId, org_id: org.id, session_id: sessionId, object_path: objectPath,
        sha256_client: hash, original_filename: file.name,
        media_type: file.type.toLowerCase(), bytes: file.size
      })
    });
    receipts.push({
      sessionId, photoId, sha256Client: hash, objectPath,
      integrityState: 'client_claim_unverified'
    });
  }
  return receipts;
}
