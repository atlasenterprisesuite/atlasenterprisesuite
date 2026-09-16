import { sameScope, type TenantScope } from '../../core/src/index';
import type { NightCheckpoint, NightQueueItem, NightSessionSummary } from '../../task-protocol/src';
import type { NightOperationsPersistencePort } from './nightOperationsPersistence';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isEligible(item: NightQueueItem, now: string): boolean {
  if (item.nextEligibleAt && item.nextEligibleAt > now) return false;
  if (item.status === 'queued') return true;
  if ((item.status === 'leased' || item.status === 'running') && item.leaseExpiresAt && item.leaseExpiresAt <= now) {
    return true;
  }
  return false;
}

export class InMemoryNightOperationsPersistence implements NightOperationsPersistencePort {
  readonly durable = false;
  private readonly items = new Map<string, NightQueueItem>();
  private readonly checkpoints: NightCheckpoint[] = [];
  private readonly summaries = new Map<string, NightSessionSummary>();

  async enqueueNightItem(item: NightQueueItem): Promise<void> {
    if (this.items.has(item.queueItemId)) throw new Error(`Night queue item already exists: ${item.queueItemId}`);
    this.items.set(item.queueItemId, clone(item));
  }

  async claimNextNightItem(
    scope: TenantScope,
    workerId: string,
    now: string,
    leaseUntil: string,
  ): Promise<NightQueueItem | null> {
    const candidates = [...this.items.values()]
      .filter((item) => sameScope(item.scope, scope) && isEligible(item, now) && item.attempt < item.maxAttempts)
      .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));

    const candidate = candidates[0];
    if (!candidate) return null;

    const current = this.items.get(candidate.queueItemId);
    if (!current || !sameScope(current.scope, scope) || !isEligible(current, now)) return null;

    const claimed: NightQueueItem = {
      ...current,
      status: 'leased',
      attempt: current.attempt + 1,
      leaseOwner: workerId,
      leaseExpiresAt: leaseUntil,
      heartbeatAt: now,
      updatedAt: now,
    };
    this.items.set(claimed.queueItemId, clone(claimed));
    return clone(claimed);
  }

  async renewNightLease(
    scope: TenantScope,
    queueItemId: string,
    workerId: string,
    now: string,
    leaseUntil: string,
  ): Promise<boolean> {
    const current = this.items.get(queueItemId);
    if (!current || !sameScope(current.scope, scope) || current.leaseOwner !== workerId) return false;
    if (!current.leaseExpiresAt || current.leaseExpiresAt <= now) return false;

    this.items.set(queueItemId, clone({
      ...current,
      heartbeatAt: now,
      leaseExpiresAt: leaseUntil,
      updatedAt: now,
    }));
    return true;
  }

  async saveNightItem(item: NightQueueItem): Promise<void> {
    const current = this.items.get(item.queueItemId);
    if (current && !sameScope(current.scope, item.scope)) throw new Error('Night queue item scope cannot be changed');
    this.items.set(item.queueItemId, clone(item));
  }

  async appendNightCheckpoint(checkpoint: NightCheckpoint): Promise<void> {
    this.checkpoints.push(clone(checkpoint));
  }

  async getLatestNightCheckpoint(scope: TenantScope, queueItemId: string): Promise<NightCheckpoint | null> {
    const matches = this.checkpoints
      .filter((checkpoint) => checkpoint.queueItemId === queueItemId && sameScope(checkpoint.scope, scope))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return matches[0] ? clone(matches[0]) : null;
  }

  async saveNightSessionSummary(summary: NightSessionSummary): Promise<void> {
    const current = this.summaries.get(summary.sessionId);
    if (current && !sameScope(current.scope, summary.scope)) throw new Error('Night session summary scope cannot be changed');
    this.summaries.set(summary.sessionId, clone(summary));
  }

  async getNightSessionSummary(scope: TenantScope, sessionId: string): Promise<NightSessionSummary | null> {
    const summary = this.summaries.get(sessionId);
    if (!summary || !sameScope(summary.scope, scope)) return null;
    return clone(summary);
  }
}
