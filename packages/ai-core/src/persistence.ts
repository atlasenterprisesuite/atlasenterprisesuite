import type { TenantScope } from '../../core/src/index';
import type { AtlasEvent, AtlasTask } from '../../task-protocol/src';

export type GitHubWebhookDeliveryClaim = {
  deliveryId: string;
  event: string;
  action: string | null;
  installationId: number | null;
  repository: string | null;
  receivedAt: string;
};

export interface PersistencePort {
  readonly durable: boolean;
  createTask(task: AtlasTask): Promise<void>;
  getTask(scope: TenantScope, taskId: string): Promise<AtlasTask | null>;
  saveTask(task: AtlasTask): Promise<void>;
  appendEvent(event: AtlasEvent): Promise<void>;
  listEvents(scope: TenantScope, taskId: string): Promise<AtlasEvent[]>;
  claimGitHubWebhookDelivery(scope: TenantScope, delivery: GitHubWebhookDeliveryClaim): Promise<boolean>;
}
