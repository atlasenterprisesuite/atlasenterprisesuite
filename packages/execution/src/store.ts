import type { AtlasWorkflow, AtlasWorkflowEvent, AtlasWorkflowStep } from './types';

export type ExecutionScope = {
  organizationId: string;
  taskId: string;
};

export interface ExecutionStore {
  getWorkflow(scope: ExecutionScope): Promise<AtlasWorkflow | null>;
  saveWorkflow(workflow: AtlasWorkflow): Promise<void>;
  listSteps(scope: ExecutionScope): Promise<AtlasWorkflowStep[]>;
  appendEvent(event: AtlasWorkflowEvent): Promise<void>;
}

export async function appendWorkflowEvent(
  store: ExecutionStore,
  event: AtlasWorkflowEvent
): Promise<void> {
  if (!event.organizationId || !event.taskId || !event.traceId || !event.eventType) {
    throw new Error('invalid_event');
  }
  await store.appendEvent(event);
}
