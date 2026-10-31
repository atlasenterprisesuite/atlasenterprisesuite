import { describe, expect, it } from 'vitest';
import { evaluateGps5DOverlay } from '../../apps/web/src/modules/gps/gps5dOverlay';

const sample = {
  observation: { timestampMs: 100_000, accuracyM: 8, headingDeg: 90, speedMps: 5 },
  maneuver: { instruction: 'Gira a la derecha', distanceM: 120, laneGuidance: 'Carril derecho' },
  nowMs: 103_000, cameraConsent: true, arTrackingVerified: true
};
describe('GPS 5D AR safety gate', () => {
  it('allows verified AR with fresh accurate GPS, permission and tracking', () => {
    expect(evaluateGps5DOverlay(sample)).toMatchObject({
      state: 'ready', cameraOverlayAllowed: true, laneGuidance: 'Carril derecho'
    });
  });
  it('fail-closes on stale position', () => {
    expect(evaluateGps5DOverlay({ ...sample, nowMs: 120_000 })).toMatchObject({
      state: 'blocked', cameraOverlayAllowed: false, laneGuidance: null
    });
  });
  it('degrades location and hides lane inference when uncertain', () => {
    expect(evaluateGps5DOverlay({
      ...sample, observation: { ...sample.observation, accuracyM: 30 }
    })).toMatchObject({ state: 'degraded', laneGuidance: null, cameraOverlayAllowed: false });
  });
  it('requires camera consent and verified AR tracking independently', () => {
    expect(evaluateGps5DOverlay({ ...sample, cameraConsent: false }).cameraOverlayAllowed).toBe(false);
    expect(evaluateGps5DOverlay({ ...sample, arTrackingVerified: false }).cameraOverlayAllowed).toBe(false);
  });
  it('rejects missing routes and inaccurate fixes', () => {
    expect(evaluateGps5DOverlay({ ...sample, maneuver: null }).state).toBe('blocked');
    expect(evaluateGps5DOverlay({ ...sample, observation: { ...sample.observation, accuracyM: 80 } }).state).toBe('blocked');
  });
});
