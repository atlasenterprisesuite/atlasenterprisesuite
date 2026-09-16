import type { TenantScope } from '../../core/src/index';
import type { NightCheckpoint, NightQueueItem, NightSessionSummary } from '../../task-protocol/src';
import type { NightOperationsPersistencePort } from './nightOperationsPersistence';
import { eq, SupabaseRestClient, type SupabaseRestConfig } from './supabaseRest';

type QueueRow = {
  queue_item_id: string;
  task_id: string;
  source_thread_id: string | null;
  tenant_id: string;
  org_id: string;
  status: NightQueueItem['status'];
  priority: number;
  attempt: number;
  max_attempts: number;
  lease_owner: string | null;
  lease_expires_at: string | null;
  heartbeat_at: string | null;
  checkpoint_id: string | null;
  archive_policy: NightQueueItem['archivePolicy'];
  archive_eligible: boolean;
  next_eligible_at: string | null;
  created_at: string;
  updated_at: string;
};

type CheckpointRow = {
  checkpoint_id: string;
  queue_item_id: string;
  task_id: string;
  tenant_id: string;
  org_id: string;
  step_key: string;
  idempotency_key: string;
  completed_operations: string[];
  evidence_refs: string[];
  retry_count: number;
  last_successful_operation: string | null;
  created_at: string;
};

type SessionRow = {
  session_id: string;
  tenant_id: string;
  org_id: string;
  started_at: string;
  ended_at: string;
  total_queued: number;
  total_examined: number;
  total_claimed: number;
  completed_autonomous: number;
  archive_eligible: number;
  archived_confirmed: number;
  pending: number;
  requires_attention: number;
  failed: number;
  retries: number;
  blocker_categories: string[];
  human_actions_required: string[];
  evidence_refs: string[];
  created_at: string;
};

function toQueueRow(item: NightQueueItem): QueueRow {
  return {
    queue_item_id: item.queueItemId,
    task_id: item.taskId,
    source_thread_id: item.sourceThreadId,
    tenant_id: item.scope.tenantId,
    org_id: item.scope.organizationId,
    status: item.status,
    priority: item.priority,
    attempt: item.attempt,
    max_attempts: item.maxAttempts,
    lease_owner: item.leaseOwner,
    lease_expires_at: item.leaseExpiresAt,
    heartbeat_at: item.heartbeatAt,
    checkpoint_id: item.checkpointId,
    archive_policy: item.archivePolicy,
    archive_eligible: item.archiveEligible,
    next_eligible_at: item.nextEligibleAt,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function fromQueueRow(row: QueueRow): NightQueueItem {
  return {
    schemaVersion: 1,
    queueItemId: row.queue_item_id,
    taskId: row.task_id,
    sourceThreadId: row.source_thread_id,
    scope: { tenantId: row.tenant_id, organizationId: row.org_id },
    status: row.status,
    priority: row.priority,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at,
    heartbeatAt: row.heartbeat_at,
    checkpointId: row.checkpoint_id,
    archivePolicy: row.archive_policy,
    archiveEligible: row.archive_eligible,
    nextEligibleAt: row.next_eligible_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCheckpointRow(checkpoint: NightCheckpoint): CheckpointRow {
  return {
    checkpoint_id: checkpoint.checkpointId,
    queue_item_id: checkpoint.queueItemId,
    task_id: checkpoint.taskId,
    tenant_id: checkpoint.scope.tenantId,
    org_id: checkpoint.scope.organizationId,
    step_key: checkpoint.stepKey,
    idempotency_key: checkpoint.idempotencyKey,
    completed_operations: checkpoint.completedOperations,
    evidence_refs: checkpoint.evidenceRefs,
    retry_count: checkpoint.retryCount,
    last_successful_operation: checkpoint.lastSuccessfulOperation,
    created_at: checkpoint.createdAt,
  };
}

function fromCheckpointRow(row: CheckpointRow): NightCheckpoint {
  return {
    schemaVersion: 1,
    checkpointId: row.checkpoint_id,
    queueItemId: row.queue_item_id,
    taskId: row.task_id,
    scope: { tenantId: row.tenant_id, organizationId: row.org_id },
    stepKey: row.step_key,
    idempotencyKey: row.idempotency_key,
    completedOperations: row.completed_operations,
    evidenceRefs: row.evidence_refs,
    retryCount: row.retry_count,
    lastSuccessfulOperation: row.last_successful_operation,
    createdAt: row.created_at,
  };
}

function toSessionRow(summary: NightSessionSummary): SessionRow {
  return {
    session_id: summary.sessionId,
    tenant_id: summary.scope.tenantId,
    org_id: summary.scope.organizationId,
    started_at: summary.startedAt,
    ended_at: summary.endedAt,
    total_queued: summary.totalQueued,
    total_examined: summary.totalExamined,
    total_claimed: summary.totalClaimed,
    completed_autonomous: summary.completedAutonomous,
    archive_eligible: summary.archiveEligible,
    archived_confirmed: summary.archivedConfirmed,
    pending: summary.pending,
    requires_attention: summary.requiresAttention,
    failed: summary.failed,
    retries: summary.retries,
    blocker_categories: summary.blockerCategories,
    human_actions_required: summary.humanActionsRequired,
    evidence_refs: summary.evidenceRefs,
    created_at: summary.createdAt,
  };
}

function fromSessionRow(row: SessionRow): NightSessionSummary {
  return {
    schemaVersion: 1,
    sessionId: row.session_id,
    scope: { tenantId: row.tenant_id, organizationId: row.org_id },
    startedAt: row.started_at,
    endedAt: row.ended_at,
    totalQueued: row.total_queued,
    totalExamined: row.total_examined,
    totalClaimed: row.total_claimed,
    completedAutonomous: row.completed_autonomous,
    archiveEligible: row.archive_eligible,
    archivedConfirmed: row.archived_confirmed,
    pending: row.pending,
    requiresAttention: row.requires_attention,
    failed: row.failed,
    retries: row.retries,
    blockerCategories: row.blocker_categories,
    humanActionsRequired: row.human_actions_required,
    evidenceRefs: row.evidence_refs,
    createdAt: row.created_at,
  };
}

export class SupabaseNightOperationsPersistence implements NightOperationsPersistencePort {
  readonly durable = true;
  private readonly rest: SupabaseRestClient;

  constructor(config: SupabaseRestConfig) {
    this.rest = new SupabaseRestClient(config);
  }

  private async log(input: {
    scope: TenantScope;
    queueItemId?: string | null;
    taskId?: string | null;
    eventType: string;
    actorId?: string | null;
    workerId?: string | null;
    outcome?: 'success' | 'denied' | 'failed';
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.rest.request('/rest/v1/rpc/atlas_log_night_event', {
      method: 'POST',
      body: {
        p_tenant_id: input.scope.tenantId,
        p_org_id: input.scope.organizationId,
        p_queue_item_id: input.queueItemId ?? null,
        p_task_id: input.taskId ?? null,
        p_event_type: input.eventType,
        p_actor_id: input.actorId ?? null,
        p_worker_id: input.workerId ?? null,
        p_outcome: input.outcome ?? 'success',
        p_details: input.details ?? {},
      },
    });
  }

  async enqueueNightItem(item: NightQueueItem): Promise<void> {
    const rows = await this.rest.request<QueueRow[]>(
      '/rest/v1/atlas_night_queue?on_conflict=queue_item_id&select=*',
      {
        method: 'POST',
        body: toQueueRow(item),
        prefer: 'resolution=ignore-duplicates,return=representation',
      },
    );
    if (rows.length === 0) {
      const existing = await this.rest.request<QueueRow[]>(
        `/rest/v1/atlas_night_queue?select=*&queue_item_id=${eq(item.queueItemId)}&limit=1`,
      );
      const row = existing[0];
      if (!row || row.task_id !== item.taskId || row.tenant_id !== item.scope.tenantId || row.org_id !== item.scope.organizationId) {
        throw new Error(`ATLAS night queue idempotency conflict: ${item.queueItemId}`);
      }
      return;
    }
    await this.log({ scope: item.scope, queueItemId: item.queueItemId, taskId: item.taskId, eventType: 'night.queue.enqueued' });
  }

  async claimNextNightItem(
    scope: TenantScope,
    workerId: string,
    now: string,
    leaseUntil: string,
  ): Promise<NightQueueItem | null> {
    const rows = await this.rest.request<QueueRow[]>('/rest/v1/rpc/atlas_claim_night_item', {
      method: 'POST',
      body: {
        p_tenant_id: scope.tenantId,
        p_org_id: scope.organizationId,
        p_worker_id: workerId,
        p_now: now,
        p_lease_until: leaseUntil,
      },
    });
    return rows[0] ? fromQueueRow(rows[0]) : null;
  }

  async renewNightLease(
    scope: TenantScope,
    queueItemId: string,
    workerId: string,
    now: string,
    leaseUntil: string,
  ): Promise<boolean> {
    return this.rest.request<boolean>('/rest/v1/rpc/atlas_renew_night_lease', {
      method: 'POST',
      body: {
        p_tenant_id: scope.tenantId,
        p_org_id: scope.organizationId,
        p_queue_item_id: queueItemId,
        p_worker_id: workerId,
        p_now: now,
        p_lease_until: leaseUntil,
      },
    });
  }

  async saveNightItem(item: NightQueueItem): Promise<void> {
    const rows = await this.rest.request<QueueRow[]>(
      `/rest/v1/atlas_night_queue?select=*&queue_item_id=${eq(item.queueItemId)}&tenant_id=${eq(item.scope.tenantId)}&org_id=${eq(item.scope.organizationId)}`,
      {
        method: 'PATCH',
        body: toQueueRow(item),
        prefer: 'return=representation',
      },
    );
    if (rows.length !== 1) throw new Error(`ATLAS night queue item not found in scope: ${item.queueItemId}`);
    await this.log({
      scope: item.scope,
      queueItemId: item.queueItemId,
      taskId: item.taskId,
      eventType: 'night.queue.saved',
      details: { status: item.status, archiveEligible: item.archiveEligible, checkpointId: item.checkpointId },
    });
  }

  async appendNightCheckpoint(checkpoint: NightCheckpoint): Promise<void> {
    await this.rest.request(
      '/rest/v1/atlas_night_checkpoints?on_conflict=idempotency_key',
      {
        method: 'POST',
        body: toCheckpointRow(checkpoint),
        prefer: 'resolution=ignore-duplicates,return=minimal',
      },
    );
    await this.log({
      scope: checkpoint.scope,
      queueItemId: checkpoint.queueItemId,
      taskId: checkpoint.taskId,
      eventType: 'night.checkpoint.persisted',
      details: { checkpointId: checkpoint.checkpointId, stepKey: checkpoint.stepKey },
    });
  }

  async getLatestNightCheckpoint(scope: TenantScope, queueItemId: string): Promise<NightCheckpoint | null> {
    const rows = await this.rest.request<CheckpointRow[]>(
      `/rest/v1/atlas_night_checkpoints?select=*&queue_item_id=${eq(queueItemId)}&tenant_id=${eq(scope.tenantId)}&org_id=${eq(scope.organizationId)}&order=created_at.desc&limit=1`,
    );
    return rows[0] ? fromCheckpointRow(rows[0]) : null;
  }

  async saveNightSessionSummary(summary: NightSessionSummary): Promise<void> {
    const existing = await this.rest.request<SessionRow[]>(
      `/rest/v1/atlas_night_sessions?select=*&session_id=${eq(summary.sessionId)}&limit=1`,
    );
    if (existing[0] && (existing[0].tenant_id !== summary.scope.tenantId || existing[0].org_id !== summary.scope.organizationId)) {
      throw new Error(`ATLAS night session scope conflict: ${summary.sessionId}`);
    }
    await this.rest.request('/rest/v1/atlas_night_sessions?on_conflict=session_id', {
      method: 'POST',
      body: toSessionRow(summary),
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
    await this.log({
      scope: summary.scope,
      eventType: 'night.session.saved',
      details: { sessionId: summary.sessionId, completedAutonomous: summary.completedAutonomous, requiresAttention: summary.requiresAttention },
    });
  }

  async getNightSessionSummary(scope: TenantScope, sessionId: string): Promise<NightSessionSummary | null> {
    const rows = await this.rest.request<SessionRow[]>(
      `/rest/v1/atlas_night_sessions?select=*&session_id=${eq(sessionId)}&tenant_id=${eq(scope.tenantId)}&org_id=${eq(scope.organizationId)}&limit=1`,
    );
    return rows[0] ? fromSessionRow(rows[0]) : null;
  }
}
