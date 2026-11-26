import { evaluateClimateEvidence, type ClimateEvidence, type ClimateHazard } from './climate-resilience';

export type NormalizedNoaaAlert = ClimateEvidence & {
  event: string;
  headline: string;
  severity: string;
  areaDescription: string;
  evidenceState: 'reviewable';
  mayPublishAlert: false;
};

export type NoaaNormalizedResponse = {
  source: 'NOAA/NWS';
  status: 'complete' | 'partial';
  fetchedAt: string;
  requestedPoint: { latitude: number; longitude: number };
  providerCount: number;
  rejectedCount: number;
  unprocessedCount: number;
  truncated: boolean;
  mayPublishAlert: false;
  alerts: NormalizedNoaaAlert[];
};

type NoaaNormalizationContext = {
  latitude: number;
  longitude: number;
  fetchedAt: string;
  sourceUrl: string;
};
const MAX_FEATURES = 30;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const trimmed = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

/** NWS/CAP timestamps may include UTC offsets. Convert to strict UTC before evidence validation. */
function timestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function classifyNoaaHazard(event: string): ClimateHazard {
  const name = event.toLowerCase();
  if (/flood|high water/.test(name)) return 'flood';
  if (/hurricane|tropical|storm surge/.test(name)) return 'tropical-cyclone';
  if (/freeze|frost|cold|winter|snow|blizzard|ice storm|wind chill/.test(name)) return 'extreme-cold';
  if (/heat/.test(name)) return 'heat';
  if (/drought/.test(name)) return 'drought';
  return 'severe-weather';
}

/**
 * Converts the NOAA/NWS GeoJSON active-alert collection into bounded, review-only evidence.
 * Does not claim that a record is an emergency broadcast or an accurate point-level hazard.
 */
export function normalizeNoaaActiveAlerts(raw: unknown, context: NoaaNormalizationContext): NoaaNormalizedResponse {
  if (!Number.isFinite(Date.parse(context.fetchedAt))) throw new Error('invalid_retrieval_time');
  if (!Number.isFinite(context.latitude) || !Number.isFinite(context.longitude) ||
    Math.abs(context.latitude) > 90 || Math.abs(context.longitude) > 180) throw new Error('invalid_coordinates');
  if (!isRecord(raw) || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features)) {
    throw new Error('invalid_noaa_collection');
  }
  const features = raw.features as unknown[];
  const alerts: NormalizedNoaaAlert[] = [];
  let rejectedCount = 0;
  const fetchedAt = new Date(context.fetchedAt).toISOString();
  for (const rawFeature of features.slice(0, MAX_FEATURES)) {
    if (!isRecord(rawFeature) || rawFeature.type !== 'Feature' || !isRecord(rawFeature.properties)) {
      rejectedCount++; continue;
    }
    const props = rawFeature.properties;
    if (props.status !== 'Actual' || !['Alert','Update'].includes(String(props.messageType))) {
      rejectedCount++; continue;
    }
    const recordId = trimmed(props.id ?? rawFeature.id, 161);
    const event = trimmed(props.event, 120);
    const publishedAt = timestamp(props.sent);
    const validFrom = timestamp(props.effective);
    const validUntil = timestamp(props.expires);
    if (!recordId || recordId.length > 160 || !event || !publishedAt || !validFrom || !validUntil) {
      rejectedCount++; continue;
    }
    const hazard = classifyNoaaHazard(event);
    const evidence: ClimateEvidence = {
      id: recordId, hazard, mode: 'forecast',
      latitude: context.latitude, longitude: context.longitude,
      validFrom, validUntil,
      source: {
        provider: 'NOAA/NWS', url: context.sourceUrl,
        publishedAt, recordId
      }
    };
    const decision = evaluateClimateEvidence(evidence, {
      now: fetchedAt,
      trustedHosts: ['api.weather.gov'],
      providerAuthenticated: true,
      organizationAuthorized: true,
      // Active NWS records may remain valid long after their original publication.
      // The server has just fetched the active feed; effective/expires remain mandatory.
      maxPublicationAgeHours: null
    });
    if (decision.state !== 'reviewable') { rejectedCount++; continue; }
    alerts.push({
      ...evidence,
      event,
      headline: trimmed(props.headline, 500),
      severity: trimmed(props.severity, 60),
      areaDescription: trimmed(props.areaDesc, 300),
      evidenceState: 'reviewable',
      mayPublishAlert: false
    });
  }
  const unprocessedCount = features.length > MAX_FEATURES ? features.length - MAX_FEATURES : 0;
  return {
    source: 'NOAA/NWS', status: rejectedCount || unprocessedCount ? 'partial' : 'complete',
    fetchedAt,
    requestedPoint: { latitude: context.latitude, longitude: context.longitude },
    providerCount: features.length,
    rejectedCount,
    unprocessedCount,
    truncated: unprocessedCount > 0,
    mayPublishAlert: false,
    alerts
  };
}
