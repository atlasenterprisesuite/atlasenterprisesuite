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
  expect(screen.getByText('Openai Authorized Session Missing')).toBeInTheDocument();
  expect(screen.getByText('Connect an authorized OpenAI/ChatGPT session before ATLAS retries this step.')).toBeInTheDocument();
  expect(screen.queryByText('Blocked by policy')).not.toBeInTheDocument();
});


it('does not report an execution route blocker for a completed step with matching verified evidence', () => {
  const state = makeGuidedState();
  const source = state.steps[0];
  const step = { ...source, status: 'completed' as const, evidenceRequirement: ['infra_verification.production'] };
  const evidence = [{ id: 'evidence-production', taskId: step.taskId, stepId: step.id, kind: 'infra_verification.production', reference: 'atlas-infra-status:production:verified', verified: true, createdAt: '2026-10-07T21:18:08Z' }];

  render(
    <StepDetailPanel
      step={step}
      task={state.tasks[0]}
      dependencies={[]}
      evidence={evidence}
      approvals={[]}
      executionDecision={{
        route: { state: 'blocked', mechanism: null, reason: 'no_authorized_execution_path' },
        policy: { outcome: 'deny', reason: 'execution_route_blocked' },
        approvalRequired: false
      }}
      onDecideApproval={vi.fn()}
    />
  );

  expect(screen.getByText('Completed with verified evidence')).toBeInTheDocument();
  expect(screen.queryByText('No Authorized Execution Path')).not.toBeInTheDocument();
  expect(screen.queryByText('Not evaluated — execution route unavailable')).not.toBeInTheDocument();
});

it('keeps a route blocker visible when completion lacks verified required evidence', () => {
  const state = makeGuidedState();
  const source = state.steps[0];
  const step = { ...source, status: 'completed' as const, evidenceRequirement: ['infra_verification.production'] };

  render(
    <StepDetailPanel
      step={step}
      task={state.tasks[0]}
      dependencies={[]}
      evidence={[]}
      approvals={[]}
      executionDecision={{
        route: { state: 'blocked', mechanism: null, reason: 'no_authorized_execution_path' },
        policy: { outcome: 'deny', reason: 'execution_route_blocked' },
        approvalRequired: false
      }}
      onDecideApproval={vi.fn()}
    />
  );

  expect(screen.getByText('Not evaluated — execution route unavailable')).toBeInTheDocument();
  expect(screen.queryByText('Completed with verified evidence')).not.toBeInTheDocument();
});
