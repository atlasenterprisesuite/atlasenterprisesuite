import { evaluateEvidenceBundle, hasAuthenticatedEvidence, type AuthenticatedEvidence } from '../../core/src/evidence';

const catalog = [
  ['bitcoin', 'crypto_asset'],
  ['ethereum', 'crypto_asset'],
  ['solana', 'crypto_asset'],
  ['cbdc-retail', 'central_bank_money'],
  ['cbdc-wholesale', 'central_bank_money'],
  ['usd', 'sovereign_currency'],
  ['eur', 'sovereign_currency'],
  ['cny', 'sovereign_currency'],
  ['stablecoin', 'private_token'],
  ['tokenized-deposit', 'bank_deposit'],
  ['fednow', 'payment_rail'],
  ['ubs-usoi-etn', 'debt_security'],
  ['uranium', 'physical_commodity'],
  ['oil', 'physical_commodity'],
  ['gold', 'physical_commodity'],
  ['atlas-credits', 'internal_credit_concept']
] as const;

type InstrumentKind = (typeof catalog)[number][1] | 'unknown';
export type InstrumentClassification = { id: string; kind: InstrumentKind; mode: 'research_only' };
const instruments = new Map<string, InstrumentKind>(catalog);

export function classifyInstrument(id: string): InstrumentClassification {
  return { id, kind: instruments.get(id) ?? 'unknown', mode: 'research_only' };
}

export type ResearchRelation = 'dependency' | 'association' | 'causal';
export type ResearchLink = {
  from: string;
  to: string;
  relation: ResearchRelation;
  now: number;
  evidence?: AuthenticatedEvidence;
};

export type ResearchAssessment = {
  status: 'hypothesis' | 'review_candidate';
  gate: 'blocked' | 'review_only';
  productionReady: false;
  blockers: string[];
};

// These checks establish metadata completeness, not document authenticity or causality.
// Evidence must originate from a trusted adapter in a later integration; no external input
// may be promoted to a confirmed claim by this function.
export function assessResearchLink(input: ResearchLink): ResearchAssessment {
  if (!Number.isFinite(input.now)) throw new Error('invalid_research_time');
  const timestamp = new Date(input.now).toISOString();
  const endpointsKnown = input.from !== input.to &&
    classifyInstrument(input.from).kind !== 'unknown' &&
    classifyInstrument(input.to).kind !== 'unknown';
  const noncausal = input.relation === 'dependency' || input.relation === 'association';
  const metadataEligible = hasAuthenticatedEvidence(input.evidence, {
    nowMs: input.now,
    maxAgeMs: 30 * 24 * 60 * 60 * 1000,
    futureToleranceMs: 0
  });
  const assessment = evaluateEvidenceBundle({
    version: 1,
    subject: 'monetary-research-link',
    environment: 'research',
    mode: 'fail-closed',
    generatedAt: timestamp,
    checks: [
      { id: 'known-endpoints', priority: 'P0', status: endpointsKnown ? 'pass' : 'unverified', observedAt: timestamp },
      { id: 'noncausal-claim', priority: 'P0', status: noncausal ? 'pass' : 'unverified', observedAt: timestamp },
      { id: 'source-metadata', priority: 'P0', status: metadataEligible ? 'pass' : 'unverified', observedAt: timestamp }
    ]
  });
  const candidate = assessment.outcome === 'pass';
  return {
    status: candidate ? 'review_candidate' : 'hypothesis',
    gate: candidate ? 'review_only' : 'blocked',
    productionReady: false,
    blockers: [...assessment.blockers, ...assessment.failures]
  };
}
