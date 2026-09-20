import type { TenantScope } from '../../core/src/index';
import type { AtlasEvent, AtlasTask } from '../../task-protocol/src';
import type { GitHubWebhookDeliveryClaim, GitHubWebhookDeliveryStore } from './githubWebhookPersistence';
import type { PersistencePort } from './persistence';

type FetchLike = typeof fetch;

export type SupabaseRpcPersistenceOptions = {
  url: string;
  publishableKey: string;
  runtimeToken: string;
  fetchImpl?: FetchLike;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class SupabaseRpcPersistence implements PersistencePort, GitHubWebhookDeliveryStore {
  readonly durable = true;
  private readonly baseUrl: string;
  private readonly publishableKey: string;
  private readonly runtimeToken: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: SupabaseRpcPersistenceOptions) {
    if (!options.url || !options.publishableKey || !options.runtimeToken) {
      throw new Error('Supabase RPC persistence requires URL, publishable key and runtime token');
    }
    this.baseUrl = options.url.replace(/\/$/, '');
    this.publishableKey = options.publishableKey;
    this.runtimeToken = options.runtimeToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: this.publishableKey,
        'content-type': 'application/json',
        'x-atlas-runtime-token': this.runtimeToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Supabase RPC persistence request failed with HTTP ${response.status}`);
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async createTask(task: AtlasTask): Promise<void> {
    await this.rpc('atlas_orchestrator_create_task', {
      p_tenant_id: task.scope.tenantId,
      p_organization_id: task.scope.organizationId,
      p_task_id: task.taskId,
      p_schema_version: task.schemaVersion,
      p_state: task.state,
      p_task_json: clone(task),
      p_created_at: task.createdAt,
      p_updated_at: task.updatedAt,
    });
  }

  async getTask(scope: TenantScope, taskId: string): Promise<AtlasTask | null> {
    const value = await this.rpc<AtlasTask | null>('atlas_orchestrator_get_task', {
      p_tenant_id: scope.tenantId,
      p_organization_id: scope.organizationId,
      p_task_id: taskId,
    });
    return value ? clone(value) : null;
  }

  async saveTask(task: AtlasTask): Promise<void> {
    await this.rpc('atlas_orchestrator_save_task', {
      p_tenant_id: task.scope.tenantId,
      p_organization_id: task.scope.organizationId,
      p_task_id: task.taskId,
      p_schema_version: task.schemaVersion,
      p_state: task.state,
      p_task_json: clone(task),
      p_updated_at: task.updatedAt,
    });
  }

  async appendEvent(event: AtlasEvent): Promise<void> {
    await this.rpc('atlas_orchestrator_append_event', {
      p_id: event.eventId,
      p_tenant_id: event.scope.tenantId,
      p_organization_id: event.scope.organizationId,
      p_task_id: event.taskId,
      p_event_type: event.type,
      p_event_json: clone(event),
      p_occurred_at: event.createdAt,
    });
  }

  async listEvents(scope: TenantScope, taskId: string): Promise<AtlasEvent[]> {
    const value = await this.rpc<AtlasEvent[]>('atlas_orchestrator_list_events', {
      p_tenant_id: scope.tenantId,
      p_organization_id: scope.organizationId,
      p_task_id: taskId,
    });
    return Array.isArray(value) ? value.map(clone) : [];
  }

  async claimGitHubWebhookDelivery(
    scope: TenantScope,
    delivery: GitHubWebhookDeliveryClaim,
  ): Promise<boolean> {
    return Boolean(await this.rpc<boolean>('atlas_orchestrator_claim_github_delivery', {
      p_tenant_id: scope.tenantId,
      p_organization_id: scope.organizationId,
      p_delivery_id: delivery.deliveryId,
      p_event_type: delivery.event,
      p_action: delivery.action,
      p_installation_id: delivery.installationId,
      p_repository_full_name: delivery.repository,
      p_received_at: delivery.receivedAt,
    }));
  }
}
