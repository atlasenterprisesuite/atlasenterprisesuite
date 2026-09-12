import { sameScope, type TenantScope } from '../../core/src/index';
import type { AtlasEvent, AtlasTask } from '../../task-protocol/src';
import type { PersistencePort } from './persistence';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class InMemoryPersistence implements PersistencePort {
  readonly durable = false;
  private readonly tasks = new Map<string, AtlasTask>();
  private readonly events: AtlasEvent[] = [];

  async createTask(task: AtlasTask): Promise<void> {
    if (this.tasks.has(task.taskId)) throw new Error(`ATLAS task already exists: ${task.taskId}`);
    this.tasks.set(task.taskId, clone(task));
  }

  async getTask(scope: TenantScope, taskId: string): Promise<AtlasTask | null> {
    const task = this.tasks.get(taskId);
    if (!task || !sameScope(scope, task.scope)) return null;
    return clone(task);
  }

  async saveTask(task: AtlasTask): Promise<void> {
    const current = this.tasks.get(task.taskId);
    if (current && !sameScope(current.scope, task.scope)) {
      throw new Error('ATLAS task scope cannot be changed');
    }
    this.tasks.set(task.taskId, clone(task));
  }

  async appendEvent(event: AtlasEvent): Promise<void> {
    this.events.push(clone(event));
  }

  async listEvents(scope: TenantScope, taskId: string): Promise<AtlasEvent[]> {
    return this.events
      .filter((event) => event.taskId === taskId && sameScope(event.scope, scope))
      .map(clone);
  }
}
