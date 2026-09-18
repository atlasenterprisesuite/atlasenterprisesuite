import type { TenantScope } from '../../../../packages/core/src/index';
import type { NightQueueItem, NightSessionSummary } from '../../../../packages/task-protocol/src';

export function buildNightSessionSummary(input: {
  sessionId: string;
  scope: TenantScope;
  startedAt: string;
  endedAt: string;
  totalQueued: number;
  items?: NightQueueItem[];
  processedItems?: NightQueueItem[];
  finalQueueItems?: NightQueueItem[];
  retries: number;
  archivedConfirmed?: number;
  blockerCategories?: string[];
  humanActionsRequired?: string[];
  evidenceRefs?: string[];
}): NightSessionSummary {
  const processedItems = input.processedItems ?? input.items ?? [];
  const finalQueueItems = input.finalQueueItems ?? processedItems;
  const completedAutonomous = processedItems.filter((item) => item.status === 'completed_autonomous').length;
  const archiveEligible = processedItems.filter((item) => item.archiveEligible).length;
  const requiresAttention = processedItems.filter((item) => item.status === 'requires_attention').length;
  const failed = processedItems.filter((item) => item.status === 'failed').length;
  const pending = finalQueueItems.filter((item) => item.status === 'queued' || item.status === 'leased' || item.status === 'running').length;

  return {
    schemaVersion: 1,
    sessionId: input.sessionId,
    scope: input.scope,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    totalQueued: input.totalQueued,
    totalExamined: processedItems.length,
    totalClaimed: processedItems.length,
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
