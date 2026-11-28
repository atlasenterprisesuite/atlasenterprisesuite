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

export type ResearchDocument = {
  reference: string;
  from: string;
  to: string;
  relation: ResearchRelation;
  text: string;
  expectedSha256: string;
};

// Hash consistency and caller metadata do not prove origin or truth.
// Only manual research review is possible; trusted acquisition remains a separate gate.
function evaluateResearchLink(input: ResearchLink, documentIntegrity: boolean): ResearchAssessment {
  if (!Number.isFinite(input.now)) throw new Error('invalid_research_time');
  const timestamp = new Date(input.now).toISOString();
  const endpointsKnown = input.from !== input.to &&
    classifyInstrument(input.from).kind !== 'unknown' &&
    classifyInstrument(input.to).kind !== 'unknown';
  const noncausal = input.relation === 'dependency' || input.relation === 'association';
  const evidence = input.evidence;
  const metadataEligible = typeof evidence?.source === 'string' &&
    typeof evidence.reference === 'string' &&
    typeof evidence.observedAt === 'string' &&
    hasAuthenticatedEvidence(evidence, {
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
      { id: 'source-metadata', priority: 'P0', status: metadataEligible ? 'pass' : 'unverified', observedAt: timestamp },
      { id: 'document-integrity', priority: 'P0', status: documentIntegrity ? 'pass' : 'unverified', observedAt: timestamp }
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

export function assessResearchLink(input: ResearchLink): ResearchAssessment {
  return evaluateResearchLink(input, false);
}

/** Validates exact UTF-8 document bytes against a supplied digest, not a trusted signature. */
export async function assessDocumentedResearchLink(
  input: ResearchLink, document: ResearchDocument
): Promise<ResearchAssessment> {
  const snapshot = { ...input, evidence: input.evidence ? { ...input.evidence } : undefined };
  const item = { ...document };
  const limit = 1_048_576;
  let integrity = false;
  if (typeof item.reference === 'string' && item.reference.trim() !== '' &&
      item.reference === snapshot.evidence?.reference &&
      item.from === snapshot.from && item.to === snapshot.to && item.relation === snapshot.relation &&
      typeof item.text === 'string' && item.text.length > 0 && item.text.length <= limit &&
      item.text.trim().length > 0 && typeof item.expectedSha256 === 'string' &&
      /^[a-f0-9]{64}$/.test(item.expectedSha256)) {
    try {
      const bytes = new TextEncoder().encode(item.text);
      if (bytes.byteLength <= limit) {
        const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
        const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
        integrity = actual === item.expectedSha256;
      }
    } catch {
      // Missing crypto support or failed digest computation must never grant review eligibility.
      integrity = false;
    }
  }
  return evaluateResearchLink(snapshot, integrity);
}
