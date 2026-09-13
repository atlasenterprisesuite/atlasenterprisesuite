import { expect, it } from 'vitest';
import { deriveStepAction } from '../../apps/web/src/execution/view-model';
import { makeGuidedState } from '../fixtures/guidedExecution';

it('offers Execute only for a ready OpenAI-domain pilot step', () => {
  const state = makeGuidedState();
  state.workflow.workflowType = 'manager.openai_domain_verification';
  state.steps[1].status = 'ready';
  state.tasks[0].currentStepId = state.steps[1].id;
  state.workflow.currentTaskId = state.tasks[0].id;
  expect(deriveStepAction(state, state.steps[1].id)).toEqual({ kind: 'execute', label: 'Execute step', executable: true });
});

it('offers Resume for running or blocked pilot steps', () => {
  const state = makeGuidedState();
  state.workflow.workflowType = 'manager.openai_domain_verification';
  state.tasks[0].currentStepId = state.steps[1].id;
  state.workflow.currentTaskId = state.tasks[0].id;
  state.steps[1].status = 'running';
  expect(deriveStepAction(state, state.steps[1].id).kind).toBe('resume');
  state.steps[1].status = 'blocked';
  state.tasks[0].blockedReason = 'dns_propagation_pending';
  expect(deriveStepAction(state, state.steps[1].id).kind).toBe('resume');
});

it('does not invent an executor for unrelated workflows', () => {
  const state = makeGuidedState();
  state.steps[1].status = 'ready';
  state.tasks[0].currentStepId = state.steps[1].id;
  expect(deriveStepAction(state, state.steps[1].id).kind).toBe('refresh');
});
