import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StepDetailPanel } from '../../apps/web/src/execution/StepDetailPanel';
import { makeGuidedState } from '../fixtures/guidedExecution';

it('shows the server route and approval requirement without self-authorizing UI', () => {
  const state = makeGuidedState();
  const task = state.tasks[0];
  const step = state.steps[1];

  render(
    <StepDetailPanel
      step={step}
      task={task}
      dependencies={state.dependencies}
      evidence={state.evidence}
      approvals={state.approvals}
      executionDecision={{
        route: { state: 'ready', mechanism: 'api', reason: 'authorized_api_available' },
        policy: { outcome: 'require_approval', reason: 'guided_high_risk_mutation' },
        approvalRequired: true
      }}
      onDecideApproval={vi.fn()}
    />
  );

  expect(screen.getByText('API')).toBeInTheDocument();
  expect(screen.getByText('Approval required')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Execute without approval/i })).not.toBeInTheDocument();
});


it('shows a route blocker as an execution prerequisite rather than a policy denial', () => {
  const state = makeGuidedState();
  const task = { ...state.tasks[0], blockedReason: 'openai_authorized_session_missing' };
  const step = state.steps[0];

  render(
    <StepDetailPanel
      step={step}
      task={task}
      dependencies={state.dependencies}
      evidence={state.evidence}
      approvals={state.approvals}
      executionDecision={{
        route: { state: 'blocked', mechanism: null, reason: 'authorized_connection_missing' },
        policy: { outcome: 'deny', reason: 'execution_route_blocked' },
        approvalRequired: false
      }}
      onDecideApproval={vi.fn()}
    />
  );

  expect(screen.getByText('Not evaluated — execution route unavailable')).toBeInTheDocument();
  expect(screen.getByText('Openai authorized session missing')).toBeInTheDocument();
  expect(screen.getByText('Connect an authorized OpenAI/ChatGPT session before ATLAS retries this step.')).toBeInTheDocument();
  expect(screen.queryByText('Blocked by policy')).not.toBeInTheDocument();
});
