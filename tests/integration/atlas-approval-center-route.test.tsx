import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalCenterPage } from '../../apps/web/src/modules/execution/ApprovalCenterPage';
import type { ExecutionApiClient } from '../../apps/web/src/modules/execution/ExecutionApi';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('ATLAS Approval Center', () => {
  it('renders governed pending approval metadata without secret payloads', async () => {
    const pending = deferred<void>();
    const api: ExecutionApiClient = {
      async listApprovals() {
        return [{
          id: 'approval-1', task_id: 'task-1', step_id: 'step-1', module: 'tax', action_summary: 'Submit prepared tax return',
          risk_class: 'regulated', intended_external_effect: 'Transmit return to authorized filing provider', status: 'pending',
          expires_at: null, created_at: '2026-09-12T00:00:00Z'
        }];
      },
      async approve() { await pending.promise; },
      async deny() {},
      async getWorkflow() { throw new Error('not_used'); }
    };

    render(<MemoryRouter><ApprovalCenterPage api={api} /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Approval Center' })).toBeInTheDocument();
    expect(await screen.findByText('Submit prepared tax return')).toBeInTheDocument();
    expect(screen.getByText('regulated')).toBeInTheDocument();
    expect(screen.getByText('Transmit return to authorized filing provider')).toBeInTheDocument();
    expect(screen.queryByText(/cvv|pan|access_token|service_role/i)).not.toBeInTheDocument();

    const approve = screen.getByRole('button', { name: 'Approve' });
    fireEvent.click(approve);
    expect(approve).toBeDisabled();
    pending.resolve();
    await waitFor(() => expect(screen.queryByText('Submit prepared tax return')).not.toBeInTheDocument());
  });

  it('shows backend errors instead of fabricating approval success', async () => {
    const api: ExecutionApiClient = {
      async listApprovals() {
        return [{ id: 'approval-1', task_id: 'task-1', step_id: null, module: 'core', action_summary: 'Apply external change', risk_class: 'high', intended_external_effect: 'External mutation', status: 'pending', expires_at: null, created_at: '2026-09-12T00:00:00Z' }];
      },
      async approve() { throw new Error('approval_conflict'); },
      async deny() {},
      async getWorkflow() { throw new Error('not_used'); }
    };
    render(<MemoryRouter><ApprovalCenterPage api={api} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('approval_conflict');
    expect(screen.getByText('Apply external change')).toBeInTheDocument();
  });
});
