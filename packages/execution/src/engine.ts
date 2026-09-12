import { assertSameScope } from './context';
import { resolveCurrentStep } from './progress';
import type { ExecutionActor } from './types';
import type { ExecutionAdapterRegistry } from './adapter';
import type { ExecutionStore } from './store';

export type ContinueTaskResult =
  | { state: 'blocked'; reason: string }
  | { state: 'failed'; reason: string }
  | { state: 'completed_step'; stepId: string }
  | { state: 'no_action'; reason: string };

export class ExecutionEngine {
  constructor(
    private readonly store: ExecutionStore,
    private readonly registry: ExecutionAdapterRegistry
  ) {}

  async continueTask(taskId: string, actor: ExecutionActor): Promise<ContinueTaskResult> {
    const task = await this.store.getTask(taskId);
    if (!task) return { state: 'no_action', reason: 'task_not_found' };
    assertSameScope(task.scope, actor.scope);

    const steps = await this.store.listSteps(taskId);
    const completed = new Set(steps.filter((step) => step.status === 'completed').map((step) => step.id));
    const step = resolveCurrentStep(steps, completed);
    if (!step) return { state: 'no_action', reason: 'no_dependency_satisfied_step' };

    const adapter = this.registry.resolve(step.module, step.actionType);
    const validation = await adapter.validate(step);
    if (!validation.ok) return { state: 'blocked', reason: validation.errors[0] ?? 'validation_failed' };

    const authorization = await adapter.authorize(actor, step);
    if (!authorization.ok) return { state: 'blocked', reason: authorization.reason ?? 'authorization_failed' };

    const execution = await adapter.execute(step);
    if (!execution.ok) {
      await this.store.saveStep({ ...step, status: 'failed' });
      return { state: 'failed', reason: execution.errorCode ?? 'execution_failed' };
    }

    const verification = await adapter.verify(step, execution);
    if (!verification.ok) {
      await this.store.saveStep({ ...step, status: 'failed' });
      return { state: 'failed', reason: verification.reason ?? 'verification_failed' };
    }

    const completedAt = new Date().toISOString();
    await this.store.saveStep({ ...step, status: 'completed', completedAt });
    for (const item of verification.evidence) {
      await this.store.appendEvidence({
        id: crypto.randomUUID(),
        taskId,
        stepId: step.id,
        kind: item.kind,
        reference: item.reference,
        verified: item.verified,
        createdAt: completedAt
      });
    }

    const nextAction = await adapter.suggestNext(step, execution);
    await this.store.saveTask({ ...task, nextAction, updatedAt: completedAt, version: task.version + 1 });
    return { state: 'completed_step', stepId: step.id };
  }
}
