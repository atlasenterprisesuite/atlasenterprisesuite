import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import {
  decideExecutionApproval,
  loadGuidedExecutionAudit,
  loadGuidedExecutionState,
  requestExecutionApproval
} from '../../apps/web/src/execution/api';
import { makeApproval, makeGuidedState } from '../fixtures/guidedExecution';

vi.mock('../../apps/web/src/execution/api', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/execution/api')>('../../apps/web/src/execution/api');
  return {
    ...actual,
    loadGuidedExecutionState: vi.fn(),
    loadGuidedExecutionAudit: vi.fn(),
    requestExecutionApproval: vi.fn(),
    decideExecutionApproval: vi.fn()
  };
});

vi.mock('../../apps/web/src/lib/atlasSession', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/lib/atlasSession')>('../../apps/web/src/lib/atlasSession');
  return { ...actual, getActiveAtlasOrganization: vi.fn(async () => ({ id: 'org-1', role: 'owner' })) };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('atlas_access_token', 'test-token');
  vi.mocked(loadGuidedExecutionAudit).mockResolvedValue([]);
});

describe('Guided Execution approvals', () => {
  it('requests approval without browser-supplied binding version or digest', async () => {
    const state = makeGuidedState({ stepStatuses: ['completed', 'awaiting_approval', 'blocked'] });
    vi.mocked(loadGuidedExecutionState).mockResolvedValue(state);
    vi.mocked(requestExecutionApproval).mockResolvedValue({ ok: true });

    render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Request approval' }));
    await waitFor(() => expect(requestExecutionApproval).toHaveBeenCalledTimes(1));
    const input = vi.mocked(requestExecutionApproval).mock.calls[0][0];
    expect(input).toMatchObject({ taskId: 'task-1', requiredPermission: 'execution.approve' });
    expect(input).not.toHaveProperty('payloadDigest');
    expect(input).not.toHaveProperty('payloadVersion');
  });

  it('keeps canonical pending approval visible when a decision is forbidden', async () => {
    const state = makeGuidedState({ approvals: [makeApproval()], stepStatuses: ['completed', 'ready', 'blocked'] });
    vi.mocked(loadGuidedExecutionState).mockResolvedValue(state);
    vi.mocked(decideExecutionApproval).mockRejectedValue(new Error('permission_required'));

    render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);

    expect(await screen.findByText('Pending')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('permission_required');
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('fails closed on stale approval binding and instructs a fresh request', async () => {
    const state = makeGuidedState({ approvals: [makeApproval()], stepStatuses: ['completed', 'ready', 'blocked'] });
    vi.mocked(loadGuidedExecutionState).mockResolvedValue(state);
    vi.mocked(decideExecutionApproval).mockRejectedValue(new Error('approval_binding_mismatch'));

    render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('request a new approval');
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('does not render approval digests as editable controls', async () => {
    const state = makeGuidedState({ approvals: [makeApproval({ payloadDigest: 'sensitive-binding-digest' })] });
    vi.mocked(loadGuidedExecutionState).mockResolvedValue(state);

    render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);

    await screen.findByText('Pending');
    expect(screen.queryByDisplayValue('sensitive-binding-digest')).not.toBeInTheDocument();
  });
});
