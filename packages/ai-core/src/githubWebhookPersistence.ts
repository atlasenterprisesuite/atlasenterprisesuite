import type { TenantScope } from '../../core/src/index';
import type { PersistencePort } from './persistence';

export type GitHubWebhookDeliveryClaim = {
  deliveryId: string;
  event: string;
  action: string | null;
  installationId: number | null;
  repository: string | null;
  receivedAt: string;
};

export interface GitHubWebhookDeliveryStore {
  claimGitHubWebhookDelivery(
    scope: TenantScope,
    delivery: GitHubWebhookDeliveryClaim,
  ): Promise<boolean>;
}

export type AtlasRuntimePersistence = PersistencePort & GitHubWebhookDeliveryStore;
