/**
 * ATLAS GPS 5D — I-Drive development domain.
 * Pure, provider-independent functions. Client filtering is defense in depth,
 * never a substitute for Supabase RLS or server-side authorization.
 */
export type IrvDevelopment = {
  id: string;
  tenantId: string;
  title: string;
  sourceUrl: string;
  sourceDate: string;
  licenseStatus: string;
  verification: string;
  lat: number;
  lon: number;
  startYear: number;
  endYear: number;
  investmentUsd: number;
};

export type IrvAuthorization = {
  authorized: boolean;
  activeMember: boolean;
};

export type IrvValidation = {
  valid: boolean;
  publishable: boolean;
  accessibilityLabel: string;
  reasons: string[];
};

const LICENSED = new Set(['licensed', 'public-domain', 'permission-granted']);
const HTTPS_URL = /^https:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i;

export function validateIrvDevelopment(value: unknown): IrvValidation {
  const v = value as Partial<IrvDevelopment> | null;
  const reasons: string[] = [];
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    return { valid: false, publishable: false, accessibilityLabel: 'No verificado: registro inválido', reasons: ['invalid-record'] };
  }
  for (const field of ['id', 'tenantId', 'title'] as const) {
    if (typeof v[field] !== 'string' || !v[field]?.trim()) reasons.push('invalid-' + field);
  }
  if (typeof v.sourceUrl !== 'string' || !HTTPS_URL.test(v.sourceUrl)) reasons.push('invalid-source-url');
  if (typeof v.sourceDate !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v.sourceDate)) reasons.push('invalid-source-date');
  if (typeof v.lat !== 'number' || !Number.isFinite(v.lat) || Math.abs(v.lat) > 90) reasons.push('invalid-latitude');
  if (typeof v.lon !== 'number' || !Number.isFinite(v.lon) || Math.abs(v.lon) > 180) reasons.push('invalid-longitude');
  if (!Number.isInteger(v.startYear) || !Number.isInteger(v.endYear) ||
      (v.startYear ?? 0) < 1800 || (v.endYear ?? 0) > 2300 ||
      (v.startYear ?? Infinity) > (v.endYear ?? -Infinity)) reasons.push('invalid-period');
  if (typeof v.investmentUsd !== 'number' || !Number.isFinite(v.investmentUsd) || v.investmentUsd < 0) reasons.push('invalid-investment');
  const valid = reasons.length === 0;
  const publishable = valid && v.verification === 'verified' && LICENSED.has(v.licenseStatus ?? '');
  return {
    valid,
    publishable,
    accessibilityLabel: publishable ? 'Verificado: ' + v.title : 'No verificado: ' + (v.title || 'proyecto'),
    reasons: [
      ...reasons,
      ...(v.verification === 'verified' ? [] : ['unverified-source']),
      ...(LICENSED.has(v.licenseStatus ?? '') ? [] : ['unlicensed-source'])
    ]
  };
}

/** Never use this in place of database RLS. Defaults to no access. */
export function selectVisibleDevelopments(
  records: readonly IrvDevelopment[],
  tenantId: string,
  access: IrvAuthorization = { authorized: false, activeMember: false }
): IrvDevelopment[] {
  if (!tenantId || access.authorized !== true || access.activeMember !== true) return [];
  return records.filter(record =>
    record.tenantId === tenantId && validateIrvDevelopment(record).publishable
  );
}

export function selectDevelopmentsAtYear(
  records: readonly IrvDevelopment[],
  year: number
): IrvDevelopment[] {
  if (!Number.isInteger(year)) return [];
  return records.filter(record =>
    validateIrvDevelopment(record).publishable &&
    record.startYear <= year && year <= record.endYear
  );
}

/** Scenario only: no traffic measurement, forecast or provider claim. */
export function simulateMobilityImpact(input: {
  baselineTrips: number;
  scenarioMultiplier: number;
}): { kind: 'simulation'; estimatedTrips: number | null; valid: boolean; disclaimer: string } {
  const valid = Number.isFinite(input.baselineTrips) && input.baselineTrips >= 0 &&
    Number.isFinite(input.scenarioMultiplier) && input.scenarioMultiplier >= 0 &&
    input.scenarioMultiplier <= 100;
  return {
    kind: 'simulation',
    estimatedTrips: valid ? input.baselineTrips * input.scenarioMultiplier : null,
    valid,
    disclaimer: 'Escenario hipotético, no tráfico observado ni predicción validada.'
  };
}
