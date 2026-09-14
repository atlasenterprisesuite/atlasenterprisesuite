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
  vi.mocked(loadGuidedExecutionAudit).mockResolvedValue([]);
});

describe('Guided Execution accessibility', () => {
  it('exposes status, disclosure state, selected step, and text status labels', async () => {
    vi.mocked(loadGuidedExecutionState).mockResolvedValue(makeGuidedState());
    render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);

    const disclosure = await screen.findByRole('button', { name: /Task 1 — Verify infrastructure readiness/i });
    const workflowStatus = screen.getByText('Workflow status').closest('[role="status"]');
    expect(workflowStatus).toHaveTextContent('Now');
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    const current = screen.getByRole('button', { name: /Verify Cloudflare/i });
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(screen.getAllByText(/Completed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Blocked/i).length).toBeGreaterThan(0);
  });
});
