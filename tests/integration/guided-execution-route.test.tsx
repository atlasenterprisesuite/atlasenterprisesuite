import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import { loadGuidedExecutionState } from '../../apps/web/src/execution/api';
import { makeGuidedState } from '../fixtures/guidedExecution';

vi.mock('../../apps/web/src/execution/api', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/execution/api')>('../../apps/web/src/execution/api');
  return { ...actual, loadGuidedExecutionState: vi.fn() };
});

vi.mock('../../apps/web/src/lib/atlasSession', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/lib/atlasSession')>('../../apps/web/src/lib/atlasSession');
  return {
    ...actual,
    getActiveAtlasOrganization: vi.fn(async () => ({ id: 'org-1', role: 'owner' }))
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Guided Execution route', () => {
  it('loads canonical workflow state behind ATLAS Identity', async () => {
    localStorage.setItem('atlas_access_token', 'test-token');
    vi.mocked(loadGuidedExecutionState).mockResolvedValue(makeGuidedState());

    render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Verify infrastructure readiness' })).toBeInTheDocument();
    expect(loadGuidedExecutionState).toHaveBeenCalledWith('wf-1');
  });

  it('renders a truthful workflow-not-found state', async () => {
    localStorage.setItem('atlas_access_token', 'test-token');
    vi.mocked(loadGuidedExecutionState).mockRejectedValue(new Error('workflow_not_found'));

    render(<MemoryRouter initialEntries={['/execution/missing']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Workflow not found' })).toBeInTheDocument();
    expect(screen.getByText('The workflow is unavailable in the active organization.')).toBeInTheDocument();
  });

  it('redirects an unauthenticated request to ATLAS Identity with the workflow return target', async () => {
    render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ATLAS Identity' })).toBeInTheDocument();
    });
    expect(window.localStorage.getItem('atlas_access_token')).toBeNull();
  });
});
