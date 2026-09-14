import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import {
  loadGuidedExecutionAudit,
  loadGuidedExecutionState,
  syncManagerReadiness
} from '../../apps/web/src/execution/api';
import { makeGuidedState } from '../fixtures/guidedExecution';

vi.mock('../../apps/web/src/execution/api', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/execution/api')>('../../apps/web/src/execution/api');
  return {
    ...actual,
    syncManagerReadiness: vi.fn(),
    loadGuidedExecutionState: vi.fn(),
    loadGuidedExecutionAudit: vi.fn()
  };
});

vi.mock('../../apps/web/src/lib/atlasSession', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/lib/atlasSession')>('../../apps/web/src/lib/atlasSession');
  return { ...actual, getActiveAtlasOrganization: vi.fn(async () => ({ id: 'org-1', role: 'owner' })) };
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('atlas_access_token', 'test-token');
  vi.mocked(loadGuidedExecutionState).mockResolvedValue(makeGuidedState());
  vi.mocked(loadGuidedExecutionAudit).mockResolvedValue([]);
});

describe('Manager readiness launcher', () => {
  it('syncs then replaces the launcher with the canonical generic workflow route', async () => {
    let resolveSync!: (value: { workflowId: string }) => void;
    vi.mocked(syncManagerReadiness).mockImplementation(() => new Promise((resolve) => {
      resolveSync = resolve;
    }));

    render(
      <MemoryRouter initialEntries={['/execution/manager/readiness']}>
        <App />
        <LocationProbe />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Verifying infrastructure readiness' })).toBeInTheDocument();
    expect(syncManagerReadiness).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSync({ workflowId: 'wf-manager-1' });
    });

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/execution/wf-manager-1'));
  });

  it('shows the exact sync error and retries only when requested', async () => {
    vi.mocked(syncManagerReadiness)
      .mockRejectedValueOnce(new Error('platform_tenant_not_configured'))
      .mockResolvedValueOnce({ workflowId: 'wf-manager-1' });

    render(
      <MemoryRouter initialEntries={['/execution/manager/readiness']}>
        <App />
        <LocationProbe />
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('platform_tenant_not_configured');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/execution/wf-manager-1'));
    expect(syncManagerReadiness).toHaveBeenCalledTimes(2);
  });
});
