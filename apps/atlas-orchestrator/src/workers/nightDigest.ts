import type { TenantScope } from '../../../../packages/core/src/index';
import type { NightQueueItem, NightSessionSummary } from '../../../../packages/task-protocol/src';

export function buildNightSessionSummary(input: {
  sessionId: string;
  scope: TenantScope;
  startedAt: string;
  endedAt: string;
  totalQueued: number;
  items: NightQueueItem[];
  retries: number;
  archivedConfirmed?: number;
  blockerCategories?: string[];
  humanActionsRequired?: string[];
  evidenceRefs?: string[];
}): NightSessionSummary {
  const completedAutonomous = input.items.filter((item) => item.status === 'completed_autonomous').length;
  const archiveEligible = input.items.filter((item) => item.archiveEligible).length;
  const requiresAttention = input.items.filter((item) => item.status === 'requires_attention').length;
  const failed = input.items.filter((item) => item.status === 'failed').length;
  const pending = input.items.filter((item) => item.status === 'queued' || item.status === 'leased' || item.status === 'running').length;

  return {
    schemaVersion: 1,
    sessionId: input.sessionId,
    scope: input.scope,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    totalQueued: input.totalQueued,
    totalExamined: input.items.length,
    totalClaimed: input.items.length,
    completedAutonomous,
    archiveEligible,
    archivedConfirmed: input.archivedConfirmed ?? 0,
    pending,
    requiresAttention,
    failed,
    retries: input.retries,
    blockerCategories: [...new Set(input.blockerCategories ?? [])],
    humanActionsRequired: [...new Set(input.humanActionsRequired ?? [])],
    evidenceRefs: [...new Set(input.evidenceRefs ?? [])],
    createdAt: input.endedAt,
  };
}
