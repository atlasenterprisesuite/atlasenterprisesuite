import type { TenantScope } from '../../core/src/index';
import type { AtlasEvent, AtlasTask } from '../../task-protocol/src';

export interface PersistencePort {
  readonly durable: boolean;
  createTask(task: AtlasTask): Promise<void>;
  getTask(scope: TenantScope, taskId: string): Promise<AtlasTask | null>;
  saveTask(task: AtlasTask): Promise<void>;
  appendEvent(event: AtlasEvent): Promise<void>;
  listEvents(scope: TenantScope, taskId: string): Promise<AtlasEvent[]>;
}
