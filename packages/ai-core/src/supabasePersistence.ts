import type { TenantScope } from '../../core/src/index';
import type { AtlasEvent, AtlasTask } from '../../task-protocol/src';
import type { GitHubWebhookDeliveryClaim, GitHubWebhookDeliveryStore } from './githubWebhookPersistence';
import type { PersistencePort } from './persistence';

type FetchLike = typeof fetch;

export type SupabasePersistenceOptions = {
  url: string;
  serviceRoleKey: string;
  fetchImpl?: FetchLike;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

export class SupabasePersistence implements PersistencePort, GitHubWebhookDeliveryStore {
  readonly durable = true;
  private readonly baseUrl: string;
  private readonly key: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: SupabasePersistenceOptions) {
    if (!options.url || !options.serviceRoleKey) {
      throw new Error('Supabase persistence requires URL and service-role credentials');
    }
    this.baseUrl = options.url.replace(/\/$/, '');
    this.key = options.serviceRoleKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const response = await this.fetchImpl(`${this.baseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.key,
        authorization: `Bearer ${this.key}`,
        'content-type': 'application/json',
        ...init.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`Supabase persistence request failed with HTTP ${response.status}`);
    }
    return response;
  }

  async createTask(task: AtlasTask): Promise<void> {
    await this.request('atlas_orchestrator_tasks', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        tenant_id: task.scope.tenantId,
        organization_id: task.scope.organizationId,
        task_id: task.taskId,
        schema_version: task.schemaVersion,
        state: task.state,
        task_json: clone(task),
        created_at: task.createdAt,
        updated_at: task.updatedAt,
      }),
    });
  }

  async getTask(scope: TenantScope, taskId: string): Promise<AtlasTask | null> {
    const query = `atlas_orchestrator_tasks?select=task_json&tenant_id=eq.${encode(scope.tenantId)}&organization_id=eq.${encode(scope.organizationId)}&task_id=eq.${encode(taskId)}&limit=1`;
    const response = await this.request(query, { method: 'GET' });
    const rows = await response.json() as Array<{ task_json: AtlasTask }>;
    return rows[0]?.task_json ? clone(rows[0].task_json) : null;
  }

  async saveTask(task: AtlasTask): Promise<void> {
    const query = `atlas_orchestrator_tasks?tenant_id=eq.${encode(task.scope.tenantId)}&organization_id=eq.${encode(task.scope.organizationId)}&task_id=eq.${encode(task.taskId)}`;
    await this.request(query, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        schema_version: task.schemaVersion,
        state: task.state,
        task_json: clone(task),
        updated_at: task.updatedAt,
      }),
    });
  }

  async appendEvent(event: AtlasEvent): Promise<void> {
    await this.request('atlas_orchestrator_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: event.eventId,
        tenant_id: event.scope.tenantId,
        organization_id: event.scope.organizationId,
        task_id: event.taskId,
        event_type: event.type,
        event_json: clone(event),
        occurred_at: event.createdAt,
      }),
    });
  }

  async listEvents(scope: TenantScope, taskId: string): Promise<AtlasEvent[]> {
    const query = `atlas_orchestrator_events?select=event_json&tenant_id=eq.${encode(scope.tenantId)}&organization_id=eq.${encode(scope.organizationId)}&task_id=eq.${encode(taskId)}&order=occurred_at.asc%2Cid.asc`;
    const response = await this.request(query, { method: 'GET' });
    const rows = await response.json() as Array<{ event_json: AtlasEvent }>;
    return rows.map((row) => clone(row.event_json));
  }

  async claimGitHubWebhookDelivery(
    scope: TenantScope,
    delivery: GitHubWebhookDeliveryClaim,
  ): Promise<boolean> {
    const response = await this.request('atlas_github_webhook_deliveries?select=delivery_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({
        tenant_id: scope.tenantId,
        organization_id: scope.organizationId,
        delivery_id: delivery.deliveryId,
        event_type: delivery.event,
        action: delivery.action,
        installation_id: delivery.installationId,
        repository_full_name: delivery.repository,
        received_at: delivery.receivedAt,
      }),
    });
    const rows = await response.json() as Array<{ delivery_id: string }>;
    return rows.length === 1;
  }
}
