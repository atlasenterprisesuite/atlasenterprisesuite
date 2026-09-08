import type { EvidenceStatus, FalsificationRecord } from '../types';

const terminalStatuses = new Set<EvidenceStatus>(['falsified', 'retracted']);

export function applyFalsification(current: EvidenceStatus, record: FalsificationRecord): EvidenceStatus {
  if (terminalStatuses.has(current)) return current;
  return record.resultingStatus;
}

export function falsificationCompleteness(record: FalsificationRecord): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!record.counterexample.trim()) missing.push('counterexample');
  if (!record.conclusion.trim()) missing.push('conclusion');
  if (record.alternativeExplanations.length === 0) missing.push('alternativeExplanations');
  if (record.evidenceGaps.length === 0) missing.push('evidenceGaps');
  return { complete: missing.length === 0, missing };
}
