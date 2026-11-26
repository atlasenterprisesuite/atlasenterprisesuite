/** ATLAS Climate Resilience 777 — evidence intake policy. No provider fetches or public alerts. */
export type ClimateHazard = 'flood' | 'tropical-cyclone' | 'extreme-cold' | 'heat' | 'drought' | 'severe-weather';
export type ClimateEvidenceMode = 'observation' | 'forecast' | 'scenario';

export type ClimateEvidence = {
  id: string;
  hazard: ClimateHazard;
  mode: ClimateEvidenceMode;
  latitude: number;
  longitude: number;
  validFrom: string;
  validUntil: string;
  source: { provider: string; url: string; publishedAt: string; recordId: string };
};

/** Must only be constructed within an authenticated server-side provider adapter. */
export type ClimateIntakeContext = {
  now: string;
  trustedHosts: readonly string[];
  providerAuthenticated: boolean;
  organizationAuthorized: boolean;
  /** Null only in a trusted provider adapter for still-active, long-lived alerts. Defaults to 48h. */
  maxPublicationAgeHours?: number | null;
};

export type ClimateIntakeResult = {
  state: 'reviewable' | 'rejected';
  reasons: string[];
  /** Intake records cannot publish emergencies or imply an authoritative live warning. */
  mayPublishAlert: false;
};

const hazards = new Set<ClimateHazard>(['flood', 'tropical-cyclone', 'extreme-cold', 'heat', 'drought', 'severe-weather']);
const modes = new Set<ClimateEvidenceMode>(['observation', 'forecast', 'scenario']);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const time = (value: unknown): number =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    ? Date.parse(value)
    : NaN;

/** Reject unverified, stale, malformed, cross-tenant and hypothetical evidence (fail-closed). */
export function evaluateClimateEvidence(input: unknown, context: ClimateIntakeContext): ClimateIntakeResult {
  const reasons: string[] = [];
  if (!context.organizationAuthorized) reasons.push('organization_not_authorized');
  if (!context.providerAuthenticated) reasons.push('provider_not_authenticated');
  const now = time(context.now);
  if (!Number.isFinite(now)) reasons.push('invalid_clock');
  if (!isRecord(input)) return { state: 'rejected', reasons: [...reasons, 'invalid_evidence'], mayPublishAlert: false };
  if (!nonempty(input.id) || input.id.length > 160) reasons.push('invalid_id');
  if (!hazards.has(input.hazard as ClimateHazard)) reasons.push('unsupported_hazard');
  if (!modes.has(input.mode as ClimateEvidenceMode)) reasons.push('unsupported_mode');
  if (input.mode === 'scenario') reasons.push('scenario_not_live_evidence');
  if (typeof input.latitude !== 'number' || !Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90 ||
      typeof input.longitude !== 'number' || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180) reasons.push('invalid_coordinates');
  const from = time(input.validFrom);
  const until = time(input.validUntil);
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from ||
      (Number.isFinite(now) && (from > now || until <= now))) reasons.push('outside_validity_window');
  if (!isRecord(input.source) || !nonempty(input.source.provider) ||
      !nonempty(input.source.recordId) || !nonempty(input.source.url)) {
    reasons.push('missing_source');
  } else {
    try {
      const url = new URL(input.source.url);
      if (url.protocol !== 'https:' || url.username || url.password || !context.trustedHosts.includes(url.hostname)) {
        reasons.push('untrusted_source');
      }
    } catch { reasons.push('invalid_source_url'); }
    const published = time(input.source.publishedAt);
    const maxAgeHours = context.maxPublicationAgeHours === undefined ? 48 : context.maxPublicationAgeHours;
    if (maxAgeHours !== null && (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0 || maxAgeHours > 720)) {
      reasons.push('invalid_freshness_policy');
    }
    if (!Number.isFinite(published) || !Number.isFinite(now) || published > now ||
        (maxAgeHours !== null && Number.isFinite(maxAgeHours) && now - published > maxAgeHours * 60 * 60 * 1000)) {
      reasons.push('stale_or_invalid_publication');
    }
  }
  return { state: reasons.length ? 'rejected' : 'reviewable', reasons, mayPublishAlert: false };
}
