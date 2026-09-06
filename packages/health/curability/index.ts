import { isUsableEvidence } from '../evidence';
import type { CurabilityLevel, EvidenceRecord } from '../types';

const order: Record<CurabilityLevel, number> = { C0: 0, C1: 1, C2: 2, C3: 3, C4: 4, C5: 5, C6: 6, C7: 7 };
const humanLevels = new Set<EvidenceRecord['evidenceLevel']>([
  'human_randomized', 'human_interventional', 'human_observational', 'human_case_report'
]);
const interventionalLevels = new Set<EvidenceRecord['evidenceLevel']>(['human_randomized', 'human_interventional']);

export interface CurabilityDecision {
  allowed: boolean;
  reasons: string[];
}

export function validateCurabilityUpgrade(
  current: CurabilityLevel,
  requested: CurabilityLevel,
  evidence: EvidenceRecord[]
): CurabilityDecision {
  if (order[requested] <= order[current]) return { allowed: true, reasons: ['No upward curability claim is being made.'] };

  const usable = evidence.filter(isUsableEvidence);
  if (usable.length === 0) {
    return { allowed: false, reasons: ['No usable evidence remains after excluding retracted, falsified, superseded, or invalid records.'] };
  }

  const human = usable.filter((record) => humanLevels.has(record.evidenceLevel));
  if (human.length === 0) return { allowed: false, reasons: ['Human evidence is required for a curability upgrade.'] };

  if (order[requested] <= 4) return { allowed: true, reasons: ['Human evidence supports evaluation at this non-cure classification level.'] };

  const reproducibleHuman = usable.filter((record) =>
    interventionalLevels.has(record.evidenceLevel) &&
    record.replicationStatus === 'independently_replicated' &&
    (record.sampleSize ?? 0) >= 20
  );

  if (reproducibleHuman.length === 0) {
    return { allowed: false, reasons: ['C5-C7 require reproducible human evidence; case reports, preclinical evidence, hypotheses, and biomarker responses are insufficient.'] };
  }

  if (requested === 'C5') return { allowed: true, reasons: ['Reproducible human interventional evidence is present for a defined disease or subtype.'] };

  if (requested === 'C6') {
    const populationEvidence = reproducibleHuman.filter((record) =>
      record.regulatoryStatus === 'approved' || record.regulatoryStatus === 'authorized'
    );
    if (populationEvidence.length < 2) {
      return { allowed: false, reasons: ['C6 requires replicated population-level human evidence plus applicable authorization or approval, not only individual cure evidence.'] };
    }
    return { allowed: true, reasons: ['Multiple replicated human records support population-level elimination in the defined setting.'] };
  }

  const eradicationAuthority = usable.some((record) =>
    record.sourceType === 'authority' &&
    record.replicationStatus === 'independently_replicated' &&
    /global eradication|eradicated globally/i.test(record.finding)
  );
  return eradicationAuthority
    ? { allowed: true, reasons: ['Authoritative replicated evidence supports global eradication.'] }
    : { allowed: false, reasons: ['C7 requires authoritative evidence of global eradication.'] };
}

export const curabilityDefinitions: Record<CurabilityLevel, string> = {
  C0: 'No established disease-modifying therapy',
  C1: 'Symptom control',
  C2: 'Disease progression can be modified',
  C3: 'Remission possible',
  C4: 'Durable treatment-free remission documented in selected patients',
  C5: 'Reproducible individual cure in a defined disease or subtype',
  C6: 'Population-level elimination achievable',
  C7: 'Global eradication'
};
