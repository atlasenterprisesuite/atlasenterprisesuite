import {
  createBioScanSession,
  createBioScanSnapshot,
  deleteBioScanSubjectData,
  exportBioScanData,
  getBioScanCapabilities,
  grantBioScanConsent,
  listBioScanTimeline,
  readBioScanSnapshot,
  revokeBioScanConsent,
  transitionBioScanSession,
  type BioScanCapabilities,
  type BioScanConsentRecord
} from './bioscanApi';
import type {
  BioScanCreateSessionRequest,
  BioScanCreateSnapshotRequest,
  BioScanDeleteSubjectRequest,
  BioScanExportRequest,
  BioScanTimelineRequest,
  BioScanTransitionSessionRequest,
  HumanTwinSnapshot
} from './bioscanContracts';

export type BodyTwinSnapshotView = {
  id: string;
  sessionId: string;
  capturedAt: string;
  captureMode: string;
  geometryVersion: string;
  coordinateSystem: string;
  meshRef: string | null;
  sourceSummary: Record<string, unknown>;
  confidenceSummary: Record<string, unknown>;
};

export type BioScanWorkspaceSnapshot = {
  capabilities: BioScanCapabilities;
  snapshots: BodyTwinSnapshotView[];
  loadedAt: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function toBodyTwinSnapshotView(snapshot: HumanTwinSnapshot): BodyTwinSnapshotView {
  const sourceSummary = asRecord(snapshot.source_summary);
  const confidenceSummary = asRecord(snapshot.confidence_summary);
  return {
    id: snapshot.id,
    sessionId: snapshot.bioscan_session_id,
    capturedAt: snapshot.captured_at,
    captureMode: typeof sourceSummary.capture_mode === 'string' ? sourceSummary.capture_mode : 'unknown',
    geometryVersion: snapshot.geometry_version,
    coordinateSystem: snapshot.coordinate_system,
    meshRef: snapshot.mesh_ref,
    sourceSummary,
    confidenceSummary
  };
}

export function loadBioScanCapabilities() {
  return getBioScanCapabilities();
}

export async function loadBioScanWorkspace(input: BioScanTimelineRequest = { api_version: 1 }): Promise<BioScanWorkspaceSnapshot> {
  const [capabilities, timeline] = await Promise.all([
    getBioScanCapabilities(),
    listBioScanTimeline(input)
  ]);
  return {
    capabilities,
    snapshots: timeline.snapshots.map(toBodyTwinSnapshotView),
    loadedAt: new Date().toISOString()
  };
}

export async function loadBodyTwinSnapshot(snapshotId: string) {
  const response = await readBioScanSnapshot({ api_version: 1, snapshot_id: snapshotId });
  return toBodyTwinSnapshotView(response.snapshot);
}

export async function ensureBioScanConsent(input: { subject_user_id?: string; expires_at?: string | null; policy_version?: string }): Promise<BioScanConsentRecord> {
  const result = await grantBioScanConsent(input);
  if (!result.consent) throw new Error('bioscan_consent_missing');
  return result.consent;
}

export function removeBioScanConsent(subject_user_id?: string) {
  return revokeBioScanConsent({ subject_user_id });
}

export function beginBioScanSession(input: BioScanCreateSessionRequest & { idempotency_key?: string }) {
  return createBioScanSession(input);
}

export function advanceBioScanSession(input: BioScanTransitionSessionRequest) {
  return transitionBioScanSession(input);
}

export function saveBioScanSnapshot(input: BioScanCreateSnapshotRequest) {
  return createBioScanSnapshot(input);
}

export function exportSubjectBioScan(input: BioScanExportRequest = { api_version: 1 }) {
  return exportBioScanData(input);
}

export function eraseSubjectBioScan(input: BioScanDeleteSubjectRequest) {
  return deleteBioScanSubjectData(input);
}
