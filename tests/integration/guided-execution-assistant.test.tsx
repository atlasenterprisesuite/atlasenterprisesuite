import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExecutionAssistantPanel } from '../../apps/web/src/execution/ExecutionAssistantPanel';
import { makeApproval, makeGuidedState } from '../fixtures/guidedExecution';

describe('Guided Execution Assistant panel', () => {
  it('uses the same blocked state shown by the workflow', () => {
    const state = makeGuidedState({
      taskStatus: 'blocked',
      blockedReason: 'cloudflare_not_verified',
      stepStatuses: ['completed', 'blocked', 'blocked']
    });
    render(<ExecutionAssistantPanel state={state} onSelectStep={vi.fn()} />);
    expect(screen.getByRole('complementary', { name: 'ATLAS Assistant' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/cloudflare_not_verified/i);
  });

  it('Continue selects the canonical current step without executing a provider action', () => {
    const onSelectStep = vi.fn();
    const state = makeGuidedState({ currentStepId: 'step-2', stepStatuses: ['completed', 'ready', 'blocked'] });
    render(<ExecutionAssistantPanel state={state} onSelectStep={onSelectStep} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onSelectStep).toHaveBeenCalledWith('step-2');
    expect(screen.getByRole('status')).toHaveTextContent(/persisted current step/i);
    expect(screen.getByText(/do not authorize or execute provider actions/i)).toBeInTheDocument();
  });

  it('focuses the canonical step for a pending approval rather than approving it', () => {
    const onSelectStep = vi.fn();
    const state = makeGuidedState({
      taskStatus: 'awaiting_approval',
      currentStepId: 'step-2',
      approvals: [makeApproval({ status: 'pending' })]
    });
    render(<ExecutionAssistantPanel state={state} onSelectStep={onSelectStep} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onSelectStep).toHaveBeenCalledWith('step-2');
    expect(screen.getByRole('status')).toHaveTextContent(/approval-1/i);
  });

  it('surfaces a failed current step without retrying it', () => {
    const state = makeGuidedState({
      taskStatus: 'failed',
      currentStepId: 'step-2',
      stepStatuses: ['completed', 'failed', 'blocked']
    });
    render(<ExecutionAssistantPanel state={state} onSelectStep={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('status')).toHaveTextContent(/failed/i);
  });

  it('keeps the unavailable AWS adapter visible as a blocker', () => {
    const state = makeGuidedState({
      taskStatus: 'blocked',
      blockedReason: 'AWS execution adapter not enabled',
      currentActionType: 'launch_ec2',
      stepStatuses: ['completed', 'blocked', 'blocked']
    });
    render(<ExecutionAssistantPanel state={state} onSelectStep={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('status')).toHaveTextContent(/AWS execution adapter not enabled/i);
  });

  it('reports only the persisted next action', () => {
    render(<ExecutionAssistantPanel state={makeGuidedState()} onSelectStep={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'What is next?' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Verify Cloudflare/i);
  });

  it('reports completed workflows with no next provider action', () => {
    const state = makeGuidedState({
      workflowStatus: 'completed',
      taskStatus: 'completed',
      currentStepId: 'step-3',
      stepStatuses: ['completed', 'completed', 'completed']
    });
    render(<ExecutionAssistantPanel state={state} onSelectStep={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'What is next?' }));
    expect(screen.getByRole('status')).toHaveTextContent(/no persisted next action/i);
  });

  it('updates from a new canonical state without Assistant persistence', () => {
    const blocked = makeGuidedState({
      taskStatus: 'blocked',
      blockedReason: 'cloudflare_not_verified',
      stepStatuses: ['completed', 'blocked', 'blocked']
    });
    const completed = makeGuidedState({
      workflowStatus: 'completed',
      taskStatus: 'completed',
      currentStepId: 'step-3',
      stepStatuses: ['completed', 'completed', 'completed']
    });

    const { rerender } = render(<ExecutionAssistantPanel state={blocked} onSelectStep={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/cloudflare_not_verified/i);

    rerender(<ExecutionAssistantPanel state={completed} onSelectStep={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/workflow completed/i);
  });

  it('uses native keyboard-focusable controls and a polite live status region', () => {
    render(<ExecutionAssistantPanel state={makeGuidedState()} onSelectStep={vi.fn()} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');

    for (const name of ['Continue', 'What is next?', 'Where did we stop?']) {
      const button = screen.getByRole('button', { name });
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
      button.focus();
      expect(document.activeElement).toBe(button);
    }
  });
});
