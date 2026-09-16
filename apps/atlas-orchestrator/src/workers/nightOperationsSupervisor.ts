import type { TenantScope } from '../../../../packages/core/src/index';
import type { AtlasActor } from '../../../../packages/governance/src';
import type {
  AtlasTask,
  NightCheckpoint,
  NightQueueItem,
} from '../../../../packages/task-protocol/src';
import {
  type AtlasOrchestrator,
  type NightOperationsPersistencePort,
  computeRetryDelayMs,
  isArchiveEligible,
  makeNightIdempotencyKey,
} from '../../../../packages/ai-core/src';

export type NightExecutionResult =
  | {
      status: 'completed';
      stepKey: string;
      completedOperations: string[];
      evidenceRefs: string[];
      lastSuccessfulOperation: string | null;
      verificationPassed: boolean;
      openBlockers: number;
    }
  | {
      status: 'requires_attention';
      stepKey: string;
      completedOperations: string[];
      evidenceRefs: string[];
      lastSuccessfulOperation: string | null;
      cause: string;
    }
  | {
      status: 'retry';
      stepKey: string;
      completedOperations: string[];
      evidenceRefs: string[];
      lastSuccessfulOperation: string | null;
      cause: string;
      retryAfterMs?: number | null;
    };

export interface NightExecutionContext {
  task: AtlasTask;
  item: NightQueueItem;
  checkpoint: NightCheckpoint | null;
  actor: AtlasActor;
  makeIdempotencyKey(operation: string, stepKey: string): string;
}

export type NightExecutor = (context: NightExecutionContext) => Promise<NightExecutionResult>;

function addMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

function checkpointId(item: NightQueueItem, now: string): string {
  return `NCP-${item.queueItemId}-${new Date(now).getTime()}`;
}

export class NightOperationsSupervisor {
  private readonly leaseDurationMs: number;

  constructor(private readonly options: {
    orchestrator: AtlasOrchestrator;
    persistence: NightOperationsPersistencePort;
    actor: AtlasActor;
    workerId: string;
    execute: NightExecutor;
    clock?: () => string;
    leaseDurationMs?: number;
  }) {
    this.leaseDurationMs = options.leaseDurationMs ?? 5 * 60_000;
  }

  private now(): string {
    return this.options.clock?.() ?? new Date().toISOString();
  }

  async processNext(scope: TenantScope): Promise<NightQueueItem | null> {
    const claimedAt = this.now();
    const item = await this.options.persistence.claimNextNightItem(
      scope,
      this.options.workerId,
      claimedAt,
      addMs(claimedAt, this.leaseDurationMs),
    );
    if (!item) return null;

    const task = await this.options.orchestrator.readTask(scope, item.taskId, this.options.actor);
    const previousCheckpoint = await this.options.persistence.getLatestNightCheckpoint(scope, item.queueItemId);

    const execution = await this.options.execute({
      task,
      item,
      checkpoint: previousCheckpoint,
      actor: this.options.actor,
      makeIdempotencyKey: (operation, stepKey) => makeNightIdempotencyKey({
        queueItemId: item.queueItemId,
        taskId: item.taskId,
        operation,
        stepKey,
      }),
    });

    const afterExecution = this.now();
    const checkpoint: NightCheckpoint = {
      schemaVersion: 1,
      checkpointId: checkpointId(item, afterExecution),
      queueItemId: item.queueItemId,
      taskId: item.taskId,
      scope: item.scope,
      stepKey: execution.stepKey,
      idempotencyKey: makeNightIdempotencyKey({
        queueItemId: item.queueItemId,
        taskId: item.taskId,
        operation: 'checkpoint',
        stepKey: execution.stepKey,
      }),
      completedOperations: [...execution.completedOperations],
      evidenceRefs: [...execution.evidenceRefs],
      retryCount: Math.max(0, item.attempt - 1),
      lastSuccessfulOperation: execution.lastSuccessfulOperation,
      createdAt: afterExecution,
    };
    await this.options.persistence.appendNightCheckpoint(checkpoint);

    const renewed = await this.options.persistence.renewNightLease(
      scope,
      item.queueItemId,
      this.options.workerId,
      afterExecution,
      addMs(afterExecution, this.leaseDurationMs),
    );
    if (!renewed) throw new Error(`ATLAS night lease lost for ${item.queueItemId}`);

    let updated: NightQueueItem;
    if (execution.status === 'completed') {
      const verified = execution.verificationPassed && execution.openBlockers === 0 && execution.evidenceRefs.length > 0;
      const status = verified ? 'completed_autonomous' as const : 'requires_attention' as const;
      updated = {
        ...item,
        status,
        checkpointId: checkpoint.checkpointId,
        archiveEligible: isArchiveEligible({
          status,
          verificationPassed: execution.verificationPassed,
          openBlockers: execution.openBlockers,
          archivePolicy: item.archivePolicy,
        }),
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: afterExecution,
        nextEligibleAt: null,
        updatedAt: afterExecution,
      };
    } else if (execution.status === 'requires_attention') {
      updated = {
        ...item,
        status: 'requires_attention',
        checkpointId: checkpoint.checkpointId,
        archiveEligible: false,
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: afterExecution,
        nextEligibleAt: null,
        updatedAt: afterExecution,
      };
    } else {
      const exhausted = item.attempt >= item.maxAttempts;
      updated = {
        ...item,
        status: exhausted ? 'requires_attention' : 'queued',
        checkpointId: checkpoint.checkpointId,
        archiveEligible: false,
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: afterExecution,
        nextEligibleAt: exhausted
          ? null
          : addMs(afterExecution, computeRetryDelayMs({
              attempt: item.attempt,
              retryAfterMs: execution.retryAfterMs,
            })),
        updatedAt: afterExecution,
      };
    }

    await this.options.persistence.saveNightItem(updated);
    return updated;
  }

  async runSession(scope: TenantScope, maxItems = 1_000): Promise<NightQueueItem[]> {
    const processed: NightQueueItem[] = [];
    for (let index = 0; index < maxItems; index += 1) {
      const result = await this.processNext(scope);
      if (!result) break;
      processed.push(result);
    }
    return processed;
  }
}
