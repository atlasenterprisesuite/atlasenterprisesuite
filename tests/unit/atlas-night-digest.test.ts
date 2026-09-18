import { describe, expect, it } from 'vitest';
import type { NightQueueItem } from '../../packages/task-protocol/src';
import { buildNightSessionSummary } from '../../apps/atlas-orchestrator/src/workers/nightDigest';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };

function item(id: string, status: NightQueueItem['status'], archiveEligible = false): NightQueueItem {
  return {
    schemaVersion: 1, queueItemId: id, taskId: `ATL-${id}`, sourceThreadId: null, scope,
    status, priority: 100, attempt: 1, maxAttempts: 3,
    leaseOwner: null, leaseExpiresAt: null, heartbeatAt: null, checkpointId: null,
    archivePolicy: 'eligible_on_verified_completion', archiveEligible, nextEligibleAt: null,
    createdAt: '2026-09-16T03:00:00.000Z', updatedAt: '2026-09-16T04:00:00.000Z',
  };
}

describe('ATLAS Night Operations digest', () => {
  it('keeps archive eligibility separate from confirmed external archival', () => {
    const summary = buildNightSessionSummary({
      sessionId: 'NS-1', scope,
      startedAt: '2026-09-16T03:00:00.000Z', endedAt: '2026-09-16T09:00:00.000Z',
      totalQueued: 5,
      items: [
        item('1', 'completed_autonomous', true),
        item('2', 'completed_autonomous', true),
        item('3', 'requires_attention'),
        item('4', 'failed'),
        item('5', 'queued'),
      ],
      retries: 3,
      archivedConfirmed: 0,
      blockerCategories: ['human_approval_required'],
      humanActionsRequired: ['Approve release'],
      evidenceRefs: ['audit:NS-1'],
    });

    expect(summary.completedAutonomous).toBe(2);
    expect(summary.archiveEligible).toBe(2);
    expect(summary.archivedConfirmed).toBe(0);
    expect(summary.requiresAttention).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.pending).toBe(1);
  });
});