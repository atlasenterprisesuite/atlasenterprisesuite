import { describe, expect, it } from 'vitest';
import {
  BIOSCAN_API_VERSION,
  BIOSCAN_CAPTURE_MODES,
  BIOSCAN_PROVENANCE_TYPES,
  canTransitionBioScanSession,
  validateBioScanProvenance
} from '../../apps/web/src/modules/health/bioscan/bioscanContracts';

describe('ATLAS BioScan v1 contracts', () => {
  it('publishes the versioned API and the approved capture/provenance vocabulary', () => {
    expect(BIOSCAN_API_VERSION).toBe(1);
    expect(BIOSCAN_CAPTURE_MODES).toEqual(['camera', 'camera_depth', 'lidar']);
    expect(BIOSCAN_PROVENANCE_TYPES).toEqual([
      'camera_estimate',
      'depth_sensor',
      'lidar_measurement',
      'wearable',
      'smart_scale',
      'clinical_device',
      'medical_record',
      'user_entered',
      'derived_from_verified_sources'
    ]);
  });

  it('allows only forward BioScan session transitions and keeps terminal states terminal', () => {
    expect(canTransitionBioScanSession('preparing', 'capturing')).toBe(true);
    expect(canTransitionBioScanSession('capturing', 'processing')).toBe(true);
    expect(canTransitionBioScanSession('processing', 'complete')).toBe(true);
    expect(canTransitionBioScanSession('processing', 'partial')).toBe(true);
    expect(canTransitionBioScanSession('capturing', 'failed')).toBe(true);
    expect(canTransitionBioScanSession('preparing', 'cancelled')).toBe(true);

    expect(canTransitionBioScanSession('capturing', 'preparing')).toBe(false);
    expect(canTransitionBioScanSession('complete', 'processing')).toBe(false);
    expect(canTransitionBioScanSession('partial', 'capturing')).toBe(false);
    expect(canTransitionBioScanSession('failed', 'preparing')).toBe(false);
    expect(canTransitionBioScanSession('cancelled', 'preparing')).toBe(false);
    expect(canTransitionBioScanSession('capturing', 'capturing')).toBe(false);
  });

  it('accepts traceable provenance with bounded confidence', () => {
    expect(validateBioScanProvenance({
      source_type: 'smart_scale',
      source_ref: 'scale:device-001:observation-9',
      confidence: 0.99,
      measured_at: '2026-10-05T10:00:00.000Z',
      is_estimate: false,
      method_version: 'scale-import-v1'
    })).toEqual({ ok: true });
  });

  it('rejects unsupported or incomplete provenance rather than silently downgrading it', () => {
    expect(validateBioScanProvenance({
      source_type: 'unknown_sensor' as never,
      source_ref: 'sensor:1',
      confidence: 0.5,
      measured_at: '2026-10-05T10:00:00.000Z',
      is_estimate: false,
      method_version: 'v1'
    })).toEqual({ ok: false, error: 'unsupported_source_type' });

    expect(validateBioScanProvenance({
      source_type: 'wearable',
      source_ref: '   ',
      confidence: 0.5,
      measured_at: '2026-10-05T10:00:00.000Z',
      is_estimate: false,
      method_version: 'v1'
    })).toEqual({ ok: false, error: 'source_ref_required' });

    expect(validateBioScanProvenance({
      source_type: 'wearable',
      source_ref: 'wearable:observation-1',
      confidence: 1.01,
      measured_at: '2026-10-05T10:00:00.000Z',
      is_estimate: false,
      method_version: 'v1'
    })).toEqual({ ok: false, error: 'confidence_out_of_range' });
  });

  it('requires camera-derived geometry to remain explicitly labeled as an estimate', () => {
    expect(validateBioScanProvenance({
      source_type: 'camera_estimate',
      source_ref: 'bioscan:session-1:geometry',
      confidence: 0.8,
      measured_at: '2026-10-05T10:00:00.000Z',
      is_estimate: false,
      method_version: 'camera-geometry-v1'
    })).toEqual({ ok: false, error: 'camera_source_must_be_estimate' });

    expect(validateBioScanProvenance({
      source_type: 'camera_estimate',
      source_ref: 'bioscan:session-1:geometry',
      confidence: 0.8,
      measured_at: '2026-10-05T10:00:00.000Z',
      is_estimate: true,
      method_version: 'camera-geometry-v1'
    })).toEqual({ ok: true });
  });

  it('rejects invalid timestamps and blank method versions', () => {
    expect(validateBioScanProvenance({
      source_type: 'user_entered',
      source_ref: 'profile:measurement-1',
      confidence: 1,
      measured_at: 'not-a-date',
      is_estimate: false,
      method_version: 'manual-v1'
    })).toEqual({ ok: false, error: 'measured_at_invalid' });

    expect(validateBioScanProvenance({
      source_type: 'user_entered',
      source_ref: 'profile:measurement-1',
      confidence: 1,
      measured_at: '2026-10-05T10:00:00.000Z',
      is_estimate: false,
      method_version: ''
    })).toEqual({ ok: false, error: 'method_version_required' });
  });
});
