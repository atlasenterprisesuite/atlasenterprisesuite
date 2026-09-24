import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import { loadGuidedExecutionAudit, loadGuidedExecutionState } from '../../apps/web/src/execution/api';
import { listWorkflows } from '../../apps/web/src/work/api';
import { makeGuidedState } from '../fixtures/guidedExecution';

vi.mock('../../apps/web/src/execution/api', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/execution/api')>('../../apps/web/src/execution/api');
  return { ...actual, loadGuidedExecutionState: vi.fn(), loadGuidedExecutionAudit: vi.fn() };
});

vi.mock('../../apps/web/src/work/api', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/work/api')>('../../apps/web/src/work/api');
  return { ...actual, listWorkflows: vi.fn(), createWorkWorkflow: vi.fn() };
});

vi.mock('../../apps/web/src/lib/atlasSession', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/lib/atlasSession')>('../../apps/web/src/lib/atlasSession');
  return { ...actual, getActiveAtlasOrganization: vi.fn(async () => ({ id: 'org-1', role: 'owner' })) };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('atlas_access_token', 'test-token');
  vi.mocked(listWorkflows).mockResolvedValue([]);
  vi.mocked(loadGuidedExecutionAudit).mockResolvedValue([]);
  vi.mocked(loadGuidedExecutionState).mockResolvedValue(makeGuidedState());
});

describe('ATLAS Work adjacent-route regression', () => {
  it('keeps Finance reachable after Work integration', () => {
    render(<MemoryRouter initialEntries={['/finance']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Finance' })).toBeInTheDocument();
  });

  it('keeps canonical detailed execution on /execution/:workflowId', async () => {
    render(<MemoryRouter initialEntries={['/execution/wf-1']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Verify infrastructure readiness' })).toBeInTheDocument();
    expect(loadGuidedExecutionState).toHaveBeenCalledWith('wf-1');
  });
});
