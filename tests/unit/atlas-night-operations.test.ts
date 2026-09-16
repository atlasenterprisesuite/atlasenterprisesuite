import { describe, expect, it } from 'vitest';
import type { NightCheckpoint, NightQueueItem, NightSessionSummary } from '../../packages/task-protocol/src';

describe('ATLAS Night Operations contracts', () => {
  it('represents an authorized queued task without fabricating archive state', () => {
    const item: NightQueueItem = {
      schemaVersion: 1,
      queueItemId: 'NQ-2026-000001',
      taskId: 'ATL-2026-000184',
      sourceThreadId: null,
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      status: 'queued',
      priority: 100,
      attempt: 0,
      maxAttempts: 5,
      leaseOwner: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      checkpointId: null,
      archivePolicy: 'eligible_on_verified_completion',
      archiveEligible: false,
      nextEligibleAt: null,
      createdAt: '2026-09-16T03:00:00.000Z',
      updatedAt: '2026-09-16T03:00:00.000Z',
    };

    expect(item.status).toBe('queued');
    expect(item.archiveEligible).toBe(false);
  });

  it('stores resumable checkpoint evidence separately from model context', () => {
    const checkpoint: NightCheckpoint = {
      schemaVersion: 1,
      checkpointId: 'NCP-1',
      queueItemId: 'NQ-2026-000001',
      taskId: 'ATL-2026-000184',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      stepKey: 'verify-tests',
      idempotencyKey: 'NQ-2026-000001:verify-tests',
      completedOperations: ['load-task'],
      evidenceRefs: ['evidence:test-run:1'],
      retryCount: 0,
      lastSuccessfulOperation: 'load-task',
      createdAt: '2026-09-16T03:05:00.000Z',
    };

    expect(checkpoint.evidenceRefs).toEqual(['evidence:test-run:1']);
  });

  it('keeps verified archive eligibility distinct from confirmed external archival', () => {
    const summary: NightSessionSummary = {
      schemaVersion: 1,
      sessionId: 'NS-1',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      startedAt: '2026-09-16T03:00:00.000Z',
      endedAt: '2026-09-16T09:00:00.000Z',
      totalQueued: 4,
      totalExamined: 4,
      totalClaimed: 4,
      completedAutonomous: 2,
      archiveEligible: 2,
      archivedConfirmed: 0,
      pending: 0,
      requiresAttention: 1,
      failed: 1,
      retries: 3,
      blockerCategories: ['human_approval_required'],
      humanActionsRequired: ['Approve production release ATL-2026-000184'],
      evidenceRefs: ['audit:night:NS-1'],
      createdAt: '2026-09-16T09:00:00.000Z',
    };

    expect(summary.archiveEligible).toBe(2);
    expect(summary.archivedConfirmed).toBe(0);
  });
});