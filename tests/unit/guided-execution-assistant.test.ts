import { describe, expect, it } from 'vitest';
import { buildExecutionAssistantSnapshot, resolveExecutionAssistantCommand } from '../../apps/web/src/execution/assistant';
import { makeApproval, makeGuidedState } from '../fixtures/guidedExecution';

describe('Guided Execution Assistant resolver', () => {
  it('reports the persisted blocker instead of inventing a next execution', () => {
    const state = makeGuidedState({
      taskStatus: 'blocked',
      blockedReason: 'cloudflare_not_verified',
      stepStatuses: ['completed', 'blocked', 'blocked']
    });
    const snapshot = buildExecutionAssistantSnapshot(state);
    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockedReason).toBe('cloudflare_not_verified');
  });

  it('resolves continue to the canonical current step without executing it', () => {
    const state = makeGuidedState({ currentStepId: 'step-2', stepStatuses: ['completed', 'ready', 'blocked'] });
    expect(resolveExecutionAssistantCommand('continue', state)).toEqual(expect.objectContaining({
      kind: 'focus_step', stepId: 'step-2', executesExternalAction: false
    }));
  });

  it('surfaces a pending approval before any continuation', () => {
    const state = makeGuidedState({
      taskStatus: 'awaiting_approval',
      approvals: [makeApproval({ status: 'pending' })]
    });
    expect(resolveExecutionAssistantCommand('resume', state)).toEqual(expect.objectContaining({
      kind: 'show_approval', approvalId: 'approval-1', executesExternalAction: false
    }));
  });

  it('returns completion without synthesizing another action', () => {
    const state = makeGuidedState({
      workflowStatus: 'completed',
      taskStatus: 'completed',
      stepStatuses: ['completed', 'completed', 'completed'],
      currentStepId: 'step-3'
    });
    expect(resolveExecutionAssistantCommand('what is next', state)).toEqual(expect.objectContaining({
      kind: 'completed', nextAction: null, executesExternalAction: false
    }));
  });

  it('surfaces a failed current step', () => {
    const state = makeGuidedState({
      taskStatus: 'failed',
      stepStatuses: ['completed', 'failed', 'blocked'],
      currentStepId: 'step-2'
    });
    expect(resolveExecutionAssistantCommand('continue', state)).toEqual(expect.objectContaining({
      kind: 'show_failure', stepId: 'step-2', executesExternalAction: false
    }));
  });

  it('keeps an unavailable AWS adapter as a truthful blocker', () => {
    const state = makeGuidedState({
      currentActionType: 'launch_ec2',
      taskStatus: 'blocked',
      blockedReason: 'AWS execution adapter not enabled',
      stepStatuses: ['completed', 'blocked', 'blocked']
    });
    const result = resolveExecutionAssistantCommand('continue', state);
    expect(result).toEqual(expect.objectContaining({ kind: 'show_blocker', executesExternalAction: false }));
    expect(JSON.stringify(result)).toContain('AWS execution adapter not enabled');
  });

  it('answers where execution stopped from canonical persisted state', () => {
    const state = makeGuidedState({ currentStepId: 'step-2' });
    expect(resolveExecutionAssistantCommand('where did we stop', state)).toEqual(expect.objectContaining({
      kind: 'stopped', taskId: 'task-1', stepId: 'step-2', currentAction: 'verify_cloudflare', executesExternalAction: false
    }));
  });

  it('returns only the persisted next action', () => {
    const state = makeGuidedState();
    expect(resolveExecutionAssistantCommand('qué sigue', state)).toEqual(expect.objectContaining({
      kind: 'show_next_action', nextAction: 'Verify Cloudflare', executesExternalAction: false
    }));
  });

  it('bounds unsupported phrases instead of sending them to a model or provider', () => {
    expect(resolveExecutionAssistantCommand('deploy it now', makeGuidedState())).toEqual({
      kind: 'unsupported',
      message: 'This execution command is not supported in the current workflow.',
      executesExternalAction: false
    });
  });
});
