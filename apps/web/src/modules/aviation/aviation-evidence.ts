export type AviationEvidenceSourceType =
  | 'regulator'
  | 'manufacturer'
  | 'issuer'
  | 'filing'
  | 'press'
  | 'operator'
  | 'internal';

export type AviationEvidenceTrustClass =
  | 'primary_authority'
  | 'primary_party'
  | 'secondary_reputable'
  | 'internal_verified'
  | 'unverified';

export type AviationEvidenceRecord = {
  id: string;
  aircraftId: string;
  claimKey: string;
  claimValue: string;
  sourceType: AviationEvidenceSourceType;
  publisher: string;
  title: string;
  canonicalUrl: string | null;
  retrievedAt: string;
  publishedAt: string | null;
  trustClass: AviationEvidenceTrustClass;
};

export type AviationEvidenceState = 'ready' | 'stale' | 'conflict' | 'not_configured';

const DEFAULT_STALE_AFTER_DAYS = 30;

export function classifyEvidenceState(
  records: readonly AviationEvidenceRecord[],
  now = new Date(),
  staleAfterDays = DEFAULT_STALE_AFTER_DAYS
): AviationEvidenceState {
  if (records.length === 0) return 'not_configured';

  const claims = new Map<string, Set<string>>();
  for (const record of records) {
    const values = claims.get(record.claimKey) ?? new Set<string>();
    values.add(record.claimValue.trim().toLocaleLowerCase());
    claims.set(record.claimKey, values);
  }

  if ([...claims.values()].some((values) => values.size > 1)) return 'conflict';

  const newestRetrievedAt = Math.max(
    ...records.map((record) => {
      const timestamp = Date.parse(record.retrievedAt);
      return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
    })
  );

  const freshnessWindowMs = staleAfterDays * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(newestRetrievedAt) || now.getTime() - newestRetrievedAt > freshnessWindowMs) {
    return 'stale';
  }

  return 'ready';
}
