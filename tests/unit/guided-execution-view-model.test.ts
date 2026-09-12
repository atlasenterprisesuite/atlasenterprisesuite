import { describe, expect, it } from 'vitest';
import { makeApproval, makeGuidedState } from '../fixtures/guidedExecution';
import {
  activeStep,
  activeTask,
  deriveStepAction,
  groupTasks,
  stepBlockers,
  workflowProgress
} from '../../apps/web/src/execution/view-model';

describe('Guided Execution view model', () => {
  it('computes progress only from persisted completed non-cancelled steps', () => {
    const state = makeGuidedState({ stepStatuses: ['completed', 'ready', 'blocked'] });
    expect(workflowProgress(state)).toEqual({ completed: 1, total: 3, percent: 33 });
  });

  it('never derives external execution for an unavailable provider action', () => {
    const state = makeGuidedState({ currentActionType: 'launch_ec2', stepStatuses: ['completed', 'blocked', 'blocked'] });
    expect(deriveStepAction(state, 'step-2')).toEqual({ kind: 'blocked', label: 'Resolve blocker', executable: false });
  });

  it('selects the canonical current task and step', () => {
    const state = makeGuidedState();
    expect(activeTask(state)?.id).toBe('task-1');
    expect(activeStep(state)?.id).toBe('step-2');
  });

  it('surfaces a pending approval before refresh actions', () => {
    const state = makeGuidedState({
      approvals: [makeApproval()],
      stepStatuses: ['completed', 'ready', 'blocked']
    });
    expect(deriveStepAction(state, 'step-2')).toEqual({ kind: 'review_approval', label: 'Review approval', executable: true });
  });

  it('groups tasks without changing persisted state', () => {
    const state = makeGuidedState();
    expect(groupTasks(state)).toEqual([{ module: 'manager', tasks: state.tasks }]);
  });

  it('returns persisted blockers and unresolved dependencies', () => {
    const state = makeGuidedState({ blockedReason: 'Provider unavailable' });
    state.dependencies.push({
      id: 'dep-1', taskId: 'task-1', stepId: 'step-2', dependsOnTaskId: null,
      dependsOnStepId: 'step-9', resolvedAt: null
    });
    expect(stepBlockers(state, 'step-2')).toEqual(['Provider unavailable', 'Waiting for step step-9']);
  });
});
