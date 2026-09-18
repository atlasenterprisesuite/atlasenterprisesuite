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
  classifyNightFailure,
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

type ErrorLike = Error & { code?: string; status?: number; statusCode?: number; retryAfterMs?: number };

function addMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

function checkpointId(item: NightQueueItem, now: string): string {
  return `NCP-${item.queueItemId}-${new Date(now).getTime()}`;
}

function errorCause(error: unknown): string {
  if (!(error instanceof Error)) return 'worker_error';
  const typed = error as ErrorLike;
  if (typed.code) return typed.code.toLowerCase();
  const status = typed.status ?? typed.statusCode;
  if (status) return `http_${status}`;
  if (/task not found/i.test(error.message)) return 'task_not_found';
  if (/authorization denied/i.test(error.message)) return 'authorization_denied';
  if (/provider is not configured/i.test(error.message)) return 'provider_not_configured';
  return 'worker_error';
}

function errorClassification(error: unknown): ReturnType<typeof classifyNightFailure> {
  if (!(error instanceof Error)) return 'permanent';
  const typed = error as ErrorLike;
  return classifyNightFailure({
    httpStatus: typed.status ?? typed.statusCode ?? null,
    code: typed.code ?? null,
  });
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

  private async recoverFromExecutionError(item: NightQueueItem, error: unknown): Promise<NightQueueItem> {
    const now = this.now();
    const classification = errorClassification(error);
    const cause = errorCause(error);
    const typed = error instanceof Error ? error as ErrorLike : null;
    const exhausted = item.attempt >= item.maxAttempts;
    const shouldRetry = classification === 'transient' && !exhausted;
    const updated: NightQueueItem = {
      ...item,
      status: shouldRetry ? 'queued' : 'requires_attention',
      archiveEligible: false,
      attentionReason: cause,
      leaseOwner: null,
      leaseExpiresAt: null,
      heartbeatAt: now,
      nextEligibleAt: shouldRetry
        ? addMs(now, computeRetryDelayMs({ attempt: item.attempt, retryAfterMs: typed?.retryAfterMs ?? null }))
        : null,
      updatedAt: now,
    };
    await this.options.persistence.saveNightItem(updated);
    return updated;
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

    let task: AtlasTask;
    let previousCheckpoint: NightCheckpoint | null;
    let execution: NightExecutionResult;
    try {
      task = await this.options.orchestrator.readTask(scope, item.taskId, this.options.actor);
      previousCheckpoint = await this.options.persistence.getLatestNightCheckpoint(scope, item.queueItemId);
      execution = await this.options.execute({
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
    } catch (error) {
      return this.recoverFromExecutionError(item, error);
    }

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
        attentionReason: verified ? null : 'verification_failed_or_evidence_missing',
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
        attentionReason: execution.cause,
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
        attentionReason: execution.cause,
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
