import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import { loadGuidedExecutionAudit, loadGuidedExecutionState } from '../../apps/web/src/execution/api';
import { makeGuidedState } from '../fixtures/guidedExecution';

vi.mock('../../apps/web/src/execution/api', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/execution/api')>('../../apps/web/src/execution/api');
  return { ...actual, loadGuidedExecutionState: vi.fn(), loadGuidedExecutionAudit: vi.fn() };
});

vi.mock('../../apps/web/src/lib/atlasSession', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/lib/atlasSession')>('../../apps/web/src/lib/atlasSession');
  return { ...actual, getActiveAtlasOrganization: vi.fn(async () => ({ id: 'org-1', role: 'owner' })) };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('atlas_access_token', 'test-token');
  vi.mocked(loadGuidedExecutionState).mockResolvedValue(makeGuidedState());
});

describe('Guided Execution audit', () => {
  it('keeps workflow reading available when audit permission is denied', async () => {
    vi.mocked(loadGuidedExecutionAudit).mockRejectedValue(new Error('permission_required'));

    render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Verify infrastructure readiness' })).toBeInTheDocument();
    expect(await screen.findByText('Audit history is not available for this identity.')).toBeInTheDocument();
  });

  it('renders immutable authorized audit events without resolving actor identity', async () => {
    vi.mocked(loadGuidedExecutionAudit).mockResolvedValue([{
      id: 'audit-1', actorUserId: 'user-1', taskId: 'task-1', workflowId: 'wf-1', module: 'manager',
      action: 'execution.task.transitioned', previousState: 'now', resultingState: 'blocked', evidenceIds: [],
      correlationId: 'corr-1', createdAt: '2026-09-12T13:00:00Z'
    }]);

    render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);

    expect(await screen.findByText('execution.task.transitioned')).toBeInTheDocument();
    expect(screen.getByText('user-1')).toBeInTheDocument();
    expect(screen.getByText('corr-1')).toBeInTheDocument();
  });
});
