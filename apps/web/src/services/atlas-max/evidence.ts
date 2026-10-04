import type { SpeedClass } from './contracts';
export interface UsageRecord {
  tenantId: string;
  actorId: string;
  taskId: string;
  providerId: string;
  modelId: string;
  speedClass: SpeedClass;
  units: number;
  timestamp: string;
  correlationId: string;
  evidenceRef: string;
}
export function recordUsage(record: UsageRecord): UsageRecord { return Object.freeze({ ...record }); }
export function recordEvidence<T extends object>(record: T): Readonly<T> { return Object.freeze({ ...record }); }
export function deriveEvidenceState(evidence?: { ok: boolean }): 'verified' | 'degraded' | 'unknown' {
  if (!evidence) return 'unknown';
  return evidence.ok ? 'verified' : 'degraded';
}
