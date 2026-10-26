export const GEO_001 = Object.freeze({ id: 'GEO-001', latitude: 28.3791667, longitude: -81.4941667, datum: 'WGS84' as const });
export type GeoEvidence = { source: string; capturedAt: string; sha256: string; license: string };
export type GeoResult = { status: 'verified'; features: unknown[]; evidence: GeoEvidence } | { status: 'unverified'; reason: string };
export type PositionReading = { latitude: number; longitude: number; accuracyMeters: number; observedAt: string; source: 'gnss' | 'network' };
export type Connectivity = { generation: '5g' | '4g' | 'wifi' | 'unknown'; observedAt: string };
export function evaluatePosition(reading: PositionReading | null, consent: boolean, nowMs: number): { status: 'available'; reading: PositionReading } | { status: 'blocked' | 'stale'; reason: string } {
  if (!consent) return { status: 'blocked', reason: 'consent_required' };
  if (!reading || !Number.isFinite(reading.latitude) || !Number.isFinite(reading.longitude) || Math.abs(reading.latitude) > 90 || Math.abs(reading.longitude) > 180 || !Number.isFinite(reading.accuracyMeters) || reading.accuracyMeters < 0) return { status: 'blocked', reason: 'invalid_position' };
  const age = nowMs - Date.parse(reading.observedAt);
  if (!Number.isFinite(age) || age < 0 || age > 30000) return { status: 'stale', reason: 'position_outdated' };
  return { status: 'available', reading };
}
export function spatial360State(authorized: boolean, panoramaAvailable: boolean): 'ready' | 'fallback' | 'blocked' {
  return !authorized ? 'blocked' : panoramaAvailable ? 'ready' : 'fallback';
}
export function validateGeoResponse(payload: unknown, evidence: GeoEvidence | null): GeoResult {
  if (!evidence || !/^https:\/\//.test(evidence.source) || !Number.isFinite(Date.parse(evidence.capturedAt)) || !/^[a-f0-9]{64}$/i.test(evidence.sha256) || !evidence.license.trim()) return { status: 'unverified', reason: 'missing_provenance' };
  if (!payload || typeof payload !== 'object' || !('features' in payload) || !Array.isArray(payload.features)) return { status: 'unverified', reason: 'invalid_features' };
  return { status: 'unverified', reason: 'hash_not_verified' };
}
export async function fetchArcGisReadOnly(endpoint: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.hostname !== 'ocgis4.ocfl.net' || !url.pathname.startsWith('/arcgis/rest/services/') || !url.pathname.endsWith('/query') || url.username || url.password) throw new Error('untrusted_gis_endpoint');
  if (url.searchParams.get('f') !== 'json') throw new Error('invalid_gis_format');
  const response = await fetcher(url.toString(), { method: 'GET', credentials: 'omit', redirect: 'error', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('gis_unavailable');
  const data: unknown = await response.json();
  if (data && typeof data === 'object' && 'error' in data) throw new Error('gis_provider_error');
  return data;
}

export async function verifyGeoPayload(payload: unknown, evidence: GeoEvidence | null): Promise<GeoResult> {
  const preliminary = validateGeoResponse(payload, evidence);
  if (!evidence || preliminary.status !== 'unverified' || preliminary.reason !== 'hash_not_verified') return preliminary;
  if (!globalThis.crypto?.subtle) return { status: 'unverified', reason: 'crypto_unavailable' };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const actual = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
  if (actual !== evidence.sha256.toLowerCase()) return { status: 'unverified', reason: 'sha256_mismatch' };
  return { status: 'verified', features: (payload as { features: unknown[] }).features, evidence };
}
