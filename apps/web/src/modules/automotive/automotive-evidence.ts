/**
 * Read-only, manufacturer-sourced model facts.
 * This is not a VIN lookup, image classifier, pricing feed, or dealership integration.
 * A model-level assertion must never be promoted to a specific vehicle's identity.
 */
export type AutomotiveClaimKey = 'power_bhp' | 'torque_nm' | 'zero_to_100_seconds' | 'top_speed_kmh';
export type ManufacturerSource = {
  publisher: 'McLaren Automotive';
  url: string;
  section: string;
  checkedAt: string;
};
export type AutomotiveClaim = {
  modelId: string;
  key: AutomotiveClaimKey;
  value: number;
  unit: string;
  source: ManufacturerSource;
};
export type AutomotiveClaimResolution = {
  status: 'verified' | 'conflict' | 'unverified';
  values: number[];
  sources: ManufacturerSource[];
};
export type AutomotiveModel = {
  id: string;
  manufacturer: string;
  name: string;
  description: string;
  sourceUrl: string;
};
export const AUTOMOTIVE_MODELS: readonly AutomotiveModel[] = [
  {
    id: 'mclaren-720s-spider',
    manufacturer: 'McLaren',
    name: '720S Spider',
    description: 'Legacy convertible supercar, twin-turbo 4.0L V8, carbon-fibre Monocage II-S.',
    sourceUrl: 'https://cars.mclaren.com/gl_en/legacy/720s-spider'
  },
  {
    id: 'mclaren-750s-spider',
    manufacturer: 'McLaren',
    name: '750S Spider',
    description: 'Successor convertible supercar, twin-turbo 4.0L V8, carbon-fibre Monocage II-S.',
    sourceUrl: 'https://cars.mclaren.com/uk_en/750s-spider'
  }
];

const checkedAt = '2026-11-26';
const spider720 = 'https://cars.mclaren.com/gl_en/legacy/720s-spider';
const spider720Spec = 'https://cars.mclaren.com/de_de/legacy/720s-spider';
const spider750 = 'https://cars.mclaren.com/uk_en/750s-spider';
function claim(modelId: string, key: AutomotiveClaimKey, value: number, unit: string, url: string, section: string): AutomotiveClaim {
  return { modelId, key, value, unit, source: { publisher: 'McLaren Automotive', url, section, checkedAt } };
}
export const AUTOMOTIVE_CLAIMS: readonly AutomotiveClaim[] = [
  claim('mclaren-720s-spider', 'power_bhp', 710, 'bhp', spider720, 'Overview'),
  claim('mclaren-720s-spider', 'torque_nm', 770, 'Nm', spider720, 'Overview'),
  claim('mclaren-720s-spider', 'top_speed_kmh', 341, 'km/h', spider720Spec, 'Full specification'),
  claim('mclaren-720s-spider', 'zero_to_100_seconds', 2.8, 's', spider720, 'Overview'),
  claim('mclaren-720s-spider', 'zero_to_100_seconds', 2.9, 's', spider720Spec, 'Full specification'),
  claim('mclaren-750s-spider', 'power_bhp', 740, 'bhp', spider750, 'Full specification'),
  claim('mclaren-750s-spider', 'torque_nm', 800, 'Nm', spider750, 'Full specification'),
  claim('mclaren-750s-spider', 'top_speed_kmh', 332, 'km/h', spider750, 'Full specification'),
  claim('mclaren-750s-spider', 'zero_to_100_seconds', 2.8, 's', spider750, 'Full specification')
];
/**
 * A trustworthy URL alone never authenticates a numeric claim.
 * Only the curated, source-reviewed model assertions shipped with this build
 * can be classified as verified; arbitrary caller records fail closed.
 */
function claimFingerprint(item: AutomotiveClaim): string {
  return JSON.stringify([
    item.modelId, item.key, item.value, item.unit,
    item.source.publisher, item.source.url, item.source.section, item.source.checkedAt
  ]);
}
const APPROVED_CLAIM_KEYS = new Set(AUTOMOTIVE_CLAIMS.map(claimFingerprint));

const UNITS: Record<AutomotiveClaimKey, string> = {
  power_bhp: 'bhp',
  torque_nm: 'Nm',
  zero_to_100_seconds: 's',
  top_speed_kmh: 'km/h'
};
function isTrustedSource(source: ManufacturerSource, now: Date): boolean {
  try {
    const url = new URL(source.url);
    if (url.protocol !== 'https:' || url.hostname !== 'cars.mclaren.com' ||
      source.publisher !== 'McLaren Automotive' || !source.section.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt)) return false;
    const verifiedAt = Date.parse(source.checkedAt + 'T00:00:00Z');
    return Number.isFinite(verifiedAt) && verifiedAt <= now.getTime();
  } catch {
    return false;
  }
}

export function resolveAutomotiveClaim(
  claims: readonly AutomotiveClaim[],
  modelId: string,
  key: AutomotiveClaimKey,
  now: Date = new Date()
): AutomotiveClaimResolution {
  const valid = claims.filter((item) =>
    item.modelId === modelId && item.key === key &&
    item.unit === UNITS[key] && Number.isFinite(item.value) &&
    item.value > 0 && isTrustedSource(item.source, now) &&
    APPROVED_CLAIM_KEYS.has(claimFingerprint(item))
  );
  const values = [...new Set(valid.map((item) => item.value))].sort((a, b) => a - b);
  const sources = valid.map((item) => item.source);
  return {
    status: values.length === 0 ? 'unverified' : values.length > 1 ? 'conflict' : 'verified',
    values,
    sources
  };
}
