/**
 * GPS 5D contextual HUD safety gate.
 * 5D is an ATLAS UX label, not a geolocation precision standard.
 * All visual guidance derives from provider route steps and actual position evidence.
 */
export type Gps5DObservation = {
  timestampMs: number;
  accuracyM: number | null;
  headingDeg: number | null;
  speedMps: number | null;
};
export type Gps5DManeuver = {
  instruction: string;
  distanceM: number;
  laneGuidance?: string | null;
};
export type Gps5DOverlay = {
  state: 'ready' | 'degraded' | 'blocked';
  instruction: string;
  distanceM: number | null;
  headingDeg: number | null;
  laneGuidance: string | null;
  cameraOverlayAllowed: boolean;
  reason: string;
};

export function evaluateGps5DOverlay(input: {
  observation: Gps5DObservation | null;
  maneuver: Gps5DManeuver | null;
  nowMs: number;
  cameraConsent: boolean;
  arTrackingVerified: boolean;
}): Gps5DOverlay {
  const { observation, maneuver, nowMs, cameraConsent, arTrackingVerified } = input;
  const blocked = (reason: string): Gps5DOverlay => ({
    state: 'blocked', instruction: 'Navegación visual no disponible',
    distanceM: null, headingDeg: null, laneGuidance: null,
    cameraOverlayAllowed: false, reason
  });
  if (!observation || !maneuver) return blocked('missing_live_position_or_route');
  if (!Number.isFinite(nowMs) || !Number.isFinite(observation.timestampMs) ||
      observation.timestampMs > nowMs + 1000 || nowMs - observation.timestampMs > 10_000)
    return blocked('position_stale');
  if (!Number.isFinite(observation.accuracyM) || observation.accuracyM! < 0 ||
      observation.accuracyM! > 50)
    return blocked('position_accuracy_insufficient');
  if (!Number.isFinite(maneuver.distanceM) || maneuver.distanceM < 0 ||
      !maneuver.instruction.trim())
    return blocked('invalid_maneuver');
  const confident = observation.accuracyM! <= 15;
  const heading = observation.headingDeg !== null &&
    Number.isFinite(observation.headingDeg)
    ? ((observation.headingDeg! % 360) + 360) % 360 : null;
  const ready = confident && heading !== null;
  const cameraOverlayAllowed = ready && cameraConsent && arTrackingVerified;
  return {
    state: ready ? 'ready' : 'degraded',
    instruction: maneuver.instruction,
    distanceM: maneuver.distanceM,
    headingDeg: heading,
    // Suppress lane claims unless route has lane evidence and location is reliable.
    laneGuidance: ready ? (maneuver.laneGuidance?.trim() || null) : null,
    cameraOverlayAllowed,
    reason: cameraOverlayAllowed ? 'ar_tracking_verified' :
      !ready ? 'uncertain_location_or_heading' :
      !cameraConsent ? 'camera_consent_required' : 'ar_tracking_unverified'
  };
}
