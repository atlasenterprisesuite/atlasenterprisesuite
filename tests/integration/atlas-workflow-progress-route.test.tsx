import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { WorkflowProgressPage } from '../../apps/web/src/modules/execution/WorkflowProgressPage';
import type { ExecutionApiClient } from '../../apps/web/src/modules/execution/ExecutionApi';

function client(status: 'now' | 'next' | 'blocked' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled'): ExecutionApiClient {
  return {
    async listApprovals() { return []; },
    async approve() {},
    async deny() {},
    async getWorkflow() {
      return {
        task_id: 'task-1', workflow_type: 'tax-preparation', module: 'tax', status, priority: 'high',
        current_step: 'review-return', next_action: status === 'blocked' ? 'Resolve filing provider configuration' : 'Review next step',
        blocked_reason: status === 'blocked' ? 'provider_not_configured' : null,
        evidence_ids: ['evidence-1'], trace_id: 'trace-1', updated_at: '2026-09-12T00:00:00Z', completed_at: status === 'completed' ? '2026-09-12T00:00:00Z' : null
      };
    }
  };
}

describe('ATLAS workflow progress', () => {
  it('renders exact blocker, evidence count, and next action without a false Completed state', async () => {
    render(<MemoryRouter><WorkflowProgressPage api={client('blocked')} taskId="task-1" /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Workflow Progress' })).toBeInTheDocument();
    expect(screen.getByText('provider_not_configured')).toBeInTheDocument();
    expect(screen.getByText('Resolve filing provider configuration')).toBeInTheDocument();
    expect(screen.getByText('1 verified evidence reference')).toBeInTheDocument();
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
  });

  it('renders Completed only when backend state is completed', async () => {
    render(<MemoryRouter><WorkflowProgressPage api={client('completed')} taskId="task-1" /></MemoryRouter>);
    expect(await screen.findByText('Completed')).toBeInTheDocument();
  });
});
