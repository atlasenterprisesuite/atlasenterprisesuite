import type { TenantScope } from '../../core/src/index';
import { AtlasTaskSchema, type AtlasEvent, type AtlasTask } from '../../task-protocol/src';
import type { PersistencePort } from './persistence';
import { eq, SupabaseRestClient, type SupabaseRestConfig } from './supabaseRest';

type TaskRow = { task: AtlasTask };
type EventRow = { event: AtlasEvent };

function taskRow(task: AtlasTask) {
  return {
    task_id: task.taskId,
    tenant_id: task.scope.tenantId,
    org_id: task.scope.organizationId,
    state: task.state,
    task,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

function eventRow(event: AtlasEvent) {
  return {
    event_id: event.eventId,
    task_id: event.taskId,
    tenant_id: event.scope.tenantId,
    org_id: event.scope.organizationId,
    type: event.type,
    outcome: event.outcome,
    correlation_id: event.correlationId,
    event,
    created_at: event.createdAt,
  };
}

export class SupabasePersistence implements PersistencePort {
  readonly durable = true;
  private readonly rest: SupabaseRestClient;

  constructor(config: SupabaseRestConfig) {
    this.rest = new SupabaseRestClient(config);
  }

  async createTask(task: AtlasTask): Promise<void> {
    const validated = AtlasTaskSchema.parse(task);
    await this.rest.request('/rest/v1/atlas_orchestrator_tasks', {
      method: 'POST',
      body: taskRow(validated),
      prefer: 'return=minimal',
    });
  }

  async getTask(scope: TenantScope, taskId: string): Promise<AtlasTask | null> {
    const rows = await this.rest.request<TaskRow[]>(
      `/rest/v1/atlas_orchestrator_tasks?select=task&task_id=${eq(taskId)}&tenant_id=${eq(scope.tenantId)}&org_id=${eq(scope.organizationId)}&limit=1`,
    );
    if (!rows[0]) return null;
    return AtlasTaskSchema.parse(rows[0].task);
  }

  async saveTask(task: AtlasTask): Promise<void> {
    const validated = AtlasTaskSchema.parse(task);
    const rows = await this.rest.request<TaskRow[]>(
      `/rest/v1/atlas_orchestrator_tasks?select=task&task_id=${eq(task.taskId)}&tenant_id=${eq(task.scope.tenantId)}&org_id=${eq(task.scope.organizationId)}`,
      {
        method: 'PATCH',
        body: taskRow(validated),
        prefer: 'return=representation',
      },
    );
    if (rows.length !== 1) throw new Error(`ATLAS task not found in scope: ${task.taskId}`);
  }

  async appendEvent(event: AtlasEvent): Promise<void> {
    await this.rest.request('/rest/v1/atlas_orchestrator_events', {
      method: 'POST',
      body: eventRow(event),
      prefer: 'return=minimal',
    });
  }

  async listEvents(scope: TenantScope, taskId: string): Promise<AtlasEvent[]> {
    const rows = await this.rest.request<EventRow[]>(
      `/rest/v1/atlas_orchestrator_events?select=event&task_id=${eq(taskId)}&tenant_id=${eq(scope.tenantId)}&org_id=${eq(scope.organizationId)}&order=created_at.asc`,
    );
    return rows.map((row) => row.event);
  }
}
