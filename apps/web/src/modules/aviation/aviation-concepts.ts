import type { AviationConcept } from './aviation-model';

const UNVALIDATED_METRICS: AviationConcept['metrics'] = {
  speedKph: null,
  rangeKm: null,
  payloadKg: null,
  priceUsd: null,
  valuationUsd: null
};

const UNVERIFIED_CERTIFICATION: AviationConcept['certification'] = {
  status: 'unverified',
  authority: null,
  lastVerifiedAt: null
};

const NOT_CONFIGURED_INVESTMENT: AviationConcept['investment'] = {
  status: 'not_configured',
  sharePriceUsd: null,
  minimumInvestmentUsd: null,
  valuationUsd: null,
  officialSourceUrl: null,
  officialSourceVerified: false,
  lastVerifiedAt: null
};

function concept(
  id: string,
  slug: string,
  modelName: string,
  category: AviationConcept['category'],
  categoryLabel: string,
  intendedUse: string,
  summary: string
): AviationConcept {
  return {
    id,
    slug,
    modelName,
    category,
    categoryLabel,
    intendedUse,
    summary,
    designStatus: 'concept',
    metrics: { ...UNVALIDATED_METRICS },
    certification: { ...UNVERIFIED_CERTIFICATION },
    investment: { ...NOT_CONFIGURED_INVESTMENT }
  };
}

export const AVIATION_CONCEPTS: readonly AviationConcept[] = [
  concept('atlas-a1-metro', 'atlas-a1-metro', 'ATLAS A1 Metro', 'urban', 'Urban Air Taxi', 'Short-distance urban mobility concept', 'Compact electric vertical-mobility concept for dense metropolitan connections.'),
  concept('atlas-a2-regional', 'atlas-a2-regional', 'ATLAS A2 Regional', 'regional', 'Regional eVTOL', 'Regional point-to-point mobility concept', 'Multi-seat regional air-mobility concept designed around intercity connectivity.'),
  concept('atlas-a3-solo', 'atlas-a3-solo', 'ATLAS A3 Solo', 'personal', 'Personal Flight', 'Personal mobility concept', 'Small-footprint personal-flight concept focused on individual mobility research.'),
  concept('atlas-a4-cargo', 'atlas-a4-cargo', 'ATLAS A4 Cargo', 'cargo', 'Cargo Lift', 'Cargo and logistics concept', 'Uncrewed-capable cargo-lift concept for governed logistics and supply-chain scenarios.'),
  concept('atlas-a5-rescue', 'atlas-a5-rescue', 'ATLAS A5 Rescue', 'medical', 'Medical / Rescue', 'Emergency response concept', 'Medical and rescue mobility concept intended for time-sensitive response scenarios.'),
  concept('atlas-a6-sentinel', 'atlas-a6-sentinel', 'ATLAS A6 Sentinel', 'security', 'Security / Public Safety', 'Public-safety aviation concept', 'Observation and public-safety mobility concept with no active surveillance or defense provider implied.'),
  concept('atlas-a7-explorer', 'atlas-a7-explorer', 'ATLAS A7 Explorer', 'exploration', 'Exploration', 'Remote-access exploration concept', 'Exploration mobility concept for difficult terrain and remote-access research scenarios.'),
  concept('atlas-a8-shuttle', 'atlas-a8-shuttle', 'ATLAS A8 Shuttle', 'group', 'Group Transport', 'Multi-passenger mobility concept', 'Group transport concept for governed campus, tourism and regional connection scenarios.'),
  concept('atlas-a9-agri', 'atlas-a9-agri', 'ATLAS A9 Agri', 'agriculture', 'Agriculture', 'Agricultural aviation concept', 'Agricultural support concept for observation and transport scenarios without claiming active field automation.'),
  concept('atlas-a10-hybrid', 'atlas-a10-hybrid', 'ATLAS A10 Hybrid', 'hybrid', 'Hybrid / Extended Range', 'Extended-range research concept', 'Hybrid-propulsion concept reserved for range and energy architecture research; performance remains unvalidated.')
];
