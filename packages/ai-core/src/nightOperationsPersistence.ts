import type { TenantScope } from '../../core/src/index';
import type { NightCheckpoint, NightQueueItem, NightSessionSummary } from '../../task-protocol/src';

export interface NightOperationsPersistencePort {
  readonly durable: boolean;
  enqueueNightItem(item: NightQueueItem): Promise<void>;
  listNightItems(scope: TenantScope): Promise<NightQueueItem[]>;
  claimNextNightItem(
    scope: TenantScope,
    workerId: string,
    now: string,
    leaseUntil: string,
  ): Promise<NightQueueItem | null>;
  renewNightLease(
    scope: TenantScope,
    queueItemId: string,
    workerId: string,
    now: string,
    leaseUntil: string,
  ): Promise<boolean>;
  saveNightItem(item: NightQueueItem): Promise<void>;
  appendNightCheckpoint(checkpoint: NightCheckpoint): Promise<void>;
  getLatestNightCheckpoint(scope: TenantScope, queueItemId: string): Promise<NightCheckpoint | null>;
  saveNightSessionSummary(summary: NightSessionSummary): Promise<void>;
  getNightSessionSummary(scope: TenantScope, sessionId: string): Promise<NightSessionSummary | null>;
}
