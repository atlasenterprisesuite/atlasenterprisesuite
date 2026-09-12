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
});
