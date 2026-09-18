import type { TenantScope } from '../../core/src/index';

export type NightQueueStatus =
  | 'queued'
  | 'leased'
  | 'running'
  | 'completed_autonomous'
  | 'requires_attention'
  | 'failed'
  | 'cancelled';

export type NightArchivePolicy = 'never' | 'eligible_on_verified_completion';

export interface NightQueueItem {
  schemaVersion: 1;
  queueItemId: string;
  taskId: string;
  sourceThreadId: string | null;
  scope: TenantScope;
  status: NightQueueStatus;
  priority: number;
  attempt: number;
  maxAttempts: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  heartbeatAt: string | null;
  checkpointId: string | null;
  archivePolicy: NightArchivePolicy;
  archiveEligible: boolean;
  nextEligibleAt: string | null;
  attentionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NightCheckpoint {
  schemaVersion: 1;
  checkpointId: string;
  queueItemId: string;
  taskId: string;
  scope: TenantScope;
  stepKey: string;
  idempotencyKey: string;
  completedOperations: string[];
  evidenceRefs: string[];
  retryCount: number;
  lastSuccessfulOperation: string | null;
  createdAt: string;
}

export interface NightSessionSummary {
  schemaVersion: 1;
  sessionId: string;
  scope: TenantScope;
  startedAt: string;
  endedAt: string;
  totalQueued: number;
  totalExamined: number;
  totalClaimed: number;
  completedAutonomous: number;
  archiveEligible: number;
  archivedConfirmed: number;
  pending: number;
  requiresAttention: number;
  failed: number;
  retries: number;
  blockerCategories: string[];
  humanActionsRequired: string[];
  evidenceRefs: string[];
  createdAt: string;
}
