import type { EvidenceLevel } from './types';

const labels: Record<EvidenceLevel, string> = {
  human: 'Human evidence',
  preclinical: 'Preclinical evidence',
  mechanistic: 'Mechanistic evidence',
  hypothesis: 'Hypothesis'
};

export function evidenceLabel(level: EvidenceLevel): string {
  return labels[level];
}
