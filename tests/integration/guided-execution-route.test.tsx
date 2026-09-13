import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  return {
    ...actual,
    getActiveAtlasOrganization: vi.fn(async () => ({ id: 'org-1', role: 'owner' }))
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(loadGuidedExecutionAudit).mockResolvedValue([]);
});

describe('Guided Execution route', () => {
  it('loads canonical workflow state behind ATLAS Identity', async () => {
    localStorage.setItem('atlas_access_token', 'test-token');
    vi.mocked(loadGuidedExecutionState).mockResolvedValue(makeGuidedState());

    render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Verify infrastructure readiness' })).toBeInTheDocument();
    expect(screen.getByText('1 of 3 steps completed')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /Task 1 — Verify infrastructure readiness/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const step = screen.getByRole('button', { name: /Verify Cloudflare/i });
    fireEvent.click(step);
    expect(step).toHaveAttribute('aria-current', 'step');
    expect(loadGuidedExecutionState).toHaveBeenCalledWith('wf-1');
  });

  it('reloads canonical state on remount instead of restoring browser-local execution position', async () => {
    localStorage.setItem('atlas_access_token', 'test-token');
    vi.mocked(loadGuidedExecutionState).mockResolvedValue(makeGuidedState({ currentStepId: 'step-2' }));

    const first = render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: /Verify Cloudflare/i })).toHaveAttribute('aria-current', 'step');
    first.unmount();

    render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: /Verify Cloudflare/i })).toHaveAttribute('aria-current', 'step');
    expect(loadGuidedExecutionState).toHaveBeenCalledTimes(2);
    expect(sessionStorage.length).toBe(0);
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
