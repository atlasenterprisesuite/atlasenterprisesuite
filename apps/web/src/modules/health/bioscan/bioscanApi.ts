import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../../lib/atlasSession';
import type {
  BioScanCreateSessionRequest,
  BioScanCreateSessionResponse,
  BioScanCreateSnapshotRequest,
  BioScanCreateSnapshotResponse,
  BioScanDeleteSubjectRequest,
  BioScanDeleteSubjectResponse,
  BioScanExportRequest,
  BioScanExportResponse,
  BioScanReadSnapshotRequest,
  BioScanReadSnapshotResponse,
  BioScanTimelineRequest,
  BioScanTimelineResponse,
  BioScanTransitionSessionRequest,
  BioScanTransitionSessionResponse
} from './bioscanContracts';

const BIOSCAN_CONTROL_PATH = '/functions/v1/atlas-platform-controls?api=';

type JsonRecord = Record<string, unknown>;

export type BioScanCapabilities = {
  ok: true;
  api_version: 1;
  domain: 'bioscan';
  role: string;
  permissions: { read: boolean; capture: boolean; manage: boolean; audit: boolean };
  capture_modes: { camera: boolean; camera_depth: boolean; lidar: boolean };
  raw_frame_persistence: false;
  truth_rule: string;
};

export type BioScanConsentRecord = {
  id: string;
  subject_user_id: string;
  scope: 'body_scan';
  status: 'granted' | 'revoked' | 'expired';
  granted_at: string;
  revoked_at?: string | null;
  expires_at: string | null;
  policy_version: string;
};

export type BioScanConsentResponse = {
  ok: true;
  consent: BioScanConsentRecord | null;
  idempotent: boolean;
};

async function parseBioScanResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('bioscan_invalid_response');
  }
  if (!response.ok) {
    const record = payload && typeof payload === 'object' ? payload as JsonRecord : {};
    const code = typeof record.error === 'string' ? record.error : 'request_failed';
    throw new Error(`bioscan_http_${response.status}:${code}`);
  }
  if (!payload || typeof payload !== 'object') throw new Error('bioscan_invalid_response');
  return payload as T;
}

export async function callBioScanControlPlane<T>(
  operation: string,
  body?: JsonRecord,
  method: 'GET' | 'POST' = 'POST'
): Promise<T> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch(`${BIOSCAN_CONTROL_PATH}${encodeURIComponent(operation)}`, {
    method,
    headers: {
      'x-atlas-org-id': organization.id
    },
    ...(method === 'POST' ? { body: JSON.stringify(body || {}) } : {})
  });
  return parseBioScanResponse<T>(response);
}

export function getBioScanCapabilities() {
  return callBioScanControlPlane<BioScanCapabilities>('bioscan-v1-capabilities', undefined, 'GET');
}

export function grantBioScanConsent(input: { subject_user_id?: string; expires_at?: string | null; policy_version?: string }) {
  return callBioScanControlPlane<BioScanConsentResponse>('bioscan-v1-consent-grant', input as JsonRecord);
}

export function revokeBioScanConsent(input: { subject_user_id?: string }) {
  return callBioScanControlPlane<BioScanConsentResponse>('bioscan-v1-consent-revoke', input as JsonRecord);
}

export function createBioScanSession(input: BioScanCreateSessionRequest & { idempotency_key?: string }) {
  return callBioScanControlPlane<BioScanCreateSessionResponse & { idempotent: boolean }>(
    'bioscan-v1-session-create',
    input as unknown as JsonRecord
  );
}

export function transitionBioScanSession(input: BioScanTransitionSessionRequest) {
  return callBioScanControlPlane<BioScanTransitionSessionResponse>(
    'bioscan-v1-session-transition',
    input as unknown as JsonRecord
  );
}

export function createBioScanSnapshot(input: BioScanCreateSnapshotRequest) {
  return callBioScanControlPlane<BioScanCreateSnapshotResponse>(
    'bioscan-v1-snapshot-create',
    input as unknown as JsonRecord
  );
}

export function readBioScanSnapshot(input: BioScanReadSnapshotRequest) {
  return callBioScanControlPlane<BioScanReadSnapshotResponse>(
    'bioscan-v1-snapshot-read',
    input as unknown as JsonRecord
  );
}

export function listBioScanTimeline(input: BioScanTimelineRequest = { api_version: 1 }) {
  return callBioScanControlPlane<BioScanTimelineResponse>(
    'bioscan-v1-timeline',
    input as unknown as JsonRecord
  );
}

export function exportBioScanData(input: BioScanExportRequest = { api_version: 1 }) {
  return callBioScanControlPlane<BioScanExportResponse>(
    'bioscan-v1-export',
    input as unknown as JsonRecord
  );
}

export function deleteBioScanSubjectData(input: BioScanDeleteSubjectRequest) {
  return callBioScanControlPlane<BioScanDeleteSubjectResponse>(
    'bioscan-v1-delete-subject',
    input as unknown as JsonRecord
  );
}
