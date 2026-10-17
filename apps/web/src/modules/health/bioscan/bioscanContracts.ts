export const BIOSCAN_API_VERSION = 1 as const;

export const BIOSCAN_SESSION_STATUSES = [
  'preparing',
  'capturing',
  'processing',
  'complete',
  'partial',
  'failed',
  'cancelled'
] as const;

export type BioScanSessionStatus = (typeof BIOSCAN_SESSION_STATUSES)[number];

export const BIOSCAN_CAPTURE_MODES = ['camera', 'camera_depth', 'lidar'] as const;
export type BioScanCaptureMode = (typeof BIOSCAN_CAPTURE_MODES)[number];

export const BIOSCAN_PROVENANCE_TYPES = [
  'camera_estimate',
  'depth_sensor',
  'lidar_measurement',
  'wearable',
  'smart_scale',
  'clinical_device',
  'medical_record',
  'user_entered',
  'derived_from_verified_sources'
] as const;

export type BioScanProvenanceType = (typeof BIOSCAN_PROVENANCE_TYPES)[number];

export type BioScanProvenance = {
  source_type: BioScanProvenanceType;
  source_ref: string;
  confidence: number;
  measured_at: string;
  is_estimate: boolean;
  method_version: string;
};

export type BioScanProvenanceValidation =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'unsupported_source_type'
        | 'source_ref_required'
        | 'confidence_out_of_range'
        | 'measured_at_invalid'
        | 'method_version_required'
        | 'camera_source_must_be_estimate';
    };

const ALLOWED_TRANSITIONS: Record<BioScanSessionStatus, readonly BioScanSessionStatus[]> = {
  preparing: ['capturing', 'failed', 'cancelled'],
  capturing: ['processing', 'partial', 'failed', 'cancelled'],
  processing: ['complete', 'partial', 'failed', 'cancelled'],
  complete: [],
  partial: [],
  failed: [],
  cancelled: []
};

export function canTransitionBioScanSession(
  from: BioScanSessionStatus,
  to: BioScanSessionStatus
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function validateBioScanProvenance(input: BioScanProvenance): BioScanProvenanceValidation {
  if (!BIOSCAN_PROVENANCE_TYPES.includes(input.source_type)) {
    return { ok: false, error: 'unsupported_source_type' };
  }
  if (!input.source_ref?.trim()) {
    return { ok: false, error: 'source_ref_required' };
  }
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    return { ok: false, error: 'confidence_out_of_range' };
  }
  if (!input.measured_at || !Number.isFinite(Date.parse(input.measured_at))) {
    return { ok: false, error: 'measured_at_invalid' };
  }
  if (!input.method_version?.trim()) {
    return { ok: false, error: 'method_version_required' };
  }
  if (input.source_type === 'camera_estimate' && input.is_estimate !== true) {
    return { ok: false, error: 'camera_source_must_be_estimate' };
  }
  return { ok: true };
}

export type BioScanSession = {
  id: string;
  org_id: string;
  tenant_id: string;
  subject_user_id: string;
  consent_record_id: string;
  capture_mode: BioScanCaptureMode;
  status: BioScanSessionStatus;
  device_id: string | null;
  started_at: string;
  completed_at: string | null;
  quality_score: number | null;
  coverage_score: number | null;
  failure_reason: string | null;
};

export type HumanTwinSnapshot = {
  id: string;
  org_id: string;
  tenant_id: string;
  subject_user_id: string;
  bioscan_session_id: string;
  captured_at: string;
  geometry_version: string;
  coordinate_system: string;
  mesh_ref: string | null;
  confidence_summary: Record<string, unknown>;
  source_summary: Record<string, unknown>;
};

export type BodyMeasurement = {
  id: string;
  snapshot_id: string;
  metric_key: string;
  value: number | string;
  unit: string;
  provenance: BioScanProvenance;
};

export type PostureObservation = {
  id: string;
  snapshot_id: string;
  observation_key: string;
  value: number | string;
  unit: string | null;
  provenance: BioScanProvenance;
};

export type SensorObservation = {
  id: string;
  metric_key: string;
  value: number | string;
  unit: string;
  provenance: BioScanProvenance;
};

export type BioScanCreateSessionRequest = {
  api_version: typeof BIOSCAN_API_VERSION;
  subject_user_id?: string;
  capture_mode: BioScanCaptureMode;
  consent_record_id: string;
  device_id?: string | null;
};

export type BioScanCreateSessionResponse = {
  ok: true;
  session: BioScanSession;
};

export type BioScanTransitionSessionRequest = {
  api_version: typeof BIOSCAN_API_VERSION;
  session_id: string;
  status: BioScanSessionStatus;
  failure_reason?: string | null;
};

export type BioScanTransitionSessionResponse = {
  ok: true;
  session: BioScanSession;
  idempotent: boolean;
};

export type BioScanCompleteSessionRequest = BioScanTransitionSessionRequest & {
  status: 'complete' | 'partial';
};

export type BioScanFailSessionRequest = BioScanTransitionSessionRequest & {
  status: 'failed';
  failure_reason: string;
};

export type BioScanCreateSnapshotRequest = {
  api_version: typeof BIOSCAN_API_VERSION;
  session_id: string;
  idempotency_key: string;
  geometry_version: string;
  coordinate_system: string;
  mesh_ref?: string | null;
  confidence_summary?: Record<string, unknown>;
  source_summary?: Record<string, unknown>;
};

export type BioScanCreateSnapshotResponse = {
  ok: true;
  snapshot: HumanTwinSnapshot;
  idempotent: boolean;
};

export type BioScanReadSnapshotRequest = {
  api_version: typeof BIOSCAN_API_VERSION;
  snapshot_id: string;
};

export type BioScanReadSnapshotResponse = {
  ok: true;
  snapshot: HumanTwinSnapshot;
};

export type BioScanTimelineRequest = {
  api_version: typeof BIOSCAN_API_VERSION;
  subject_user_id?: string;
  limit?: number;
};

export type BioScanTimelineResponse = {
  ok: true;
  snapshots: HumanTwinSnapshot[];
};

export type BioScanMeasurementsRequest = {
  api_version: typeof BIOSCAN_API_VERSION;
  snapshot_id: string;
};

export type BioScanMeasurementsResponse = {
  ok: true;
  measurements: BodyMeasurement[];
};

export type BioScanPostureRequest = {
  api_version: typeof BIOSCAN_API_VERSION;
  snapshot_id: string;
};

export type BioScanPostureResponse = {
  ok: true;
  observations: PostureObservation[];
};

export type BioScanCompareRequest = {
  api_version: typeof BIOSCAN_API_VERSION;
  baseline_snapshot_id: string;
  comparison_snapshot_id: string;
};

export type BioScanCompareResponse = {
  ok: true;
  baseline: HumanTwinSnapshot;
  comparison: HumanTwinSnapshot;
  measurement_deltas: Array<{
    metric_key: string;
    baseline: number | string | null;
    comparison: number | string | null;
    unit: string | null;
  }>;
};

export type BioScanAttachSensorObservationRequest = {
  api_version: typeof BIOSCAN_API_VERSION;
  subject_user_id?: string;
  metric_key: string;
  value: number | string;
  unit: string;
  provenance: BioScanProvenance;
};

export type BioScanAttachSensorObservationResponse = {
  ok: true;
  observation: SensorObservation;
};

export type BioScanResolveProvenanceRequest = {
  api_version: typeof BIOSCAN_API_VERSION;
  source_type: BioScanProvenanceType;
  source_ref: string;
};

export type BioScanResolveProvenanceResponse = {
  ok: true;
  provenance: BioScanProvenance;
};

export type BioScanExportRequest = {
  api_version: typeof BIOSCAN_API_VERSION;
  subject_user_id?: string;
};

export type BioScanExportResponse = {
  ok: true;
  exported_at: string;
  subject_user_id: string;
  sessions: BioScanSession[];
  snapshots: HumanTwinSnapshot[];
  measurements: BodyMeasurement[];
  posture_observations: PostureObservation[];
  sensor_observations: SensorObservation[];
};

export type BioScanDeleteSubjectRequest = {
  api_version: typeof BIOSCAN_API_VERSION;
  subject_user_id?: string;
  confirmation: 'DELETE_BIOSCAN_DATA';
};

export type BioScanDeleteSubjectResponse = {
  ok: true;
  subject_user_id: string;
  deleted_counts: Record<string, number>;
};
