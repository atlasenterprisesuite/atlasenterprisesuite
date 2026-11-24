import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import { startManagerSovereignCi } from '../../apps/web/src/execution/api';

vi.mock('../../apps/web/src/execution/api', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/execution/api')>('../../apps/web/src/execution/api');
  return {
    ...actual,
    startManagerSovereignCi: vi.fn()
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
});

describe('ATLAS Manager Sovereign CI launcher', () => {
  it('renders behind ATLAS identity with an explicit editable repository and ref', async () => {
    render(
      <MemoryRouter initialEntries={['/execution/manager/sovereign-ci']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Sovereign CI' })).toBeInTheDocument();
    expect(screen.getByLabelText('Repository')).toHaveValue('atlasenterprisesuite/atlasenterprisesuite');
    expect(screen.getByLabelText('Branch, tag, or SHA')).toHaveValue('');
  });

  it('starts the canonical workflow and redirects to generic Guided Execution', async () => {
    vi.mocked(startManagerSovereignCi).mockResolvedValue({ workflowId: 'wf-ci-1' });

    render(
      <MemoryRouter initialEntries={['/execution/manager/sovereign-ci']}>
        <App />
        <LocationProbe />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByLabelText('Branch, tag, or SHA'), { target: { value: 'feat/example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run verification' }));

    await waitFor(() => expect(startManagerSovereignCi).toHaveBeenCalledWith({
      repository: 'atlasenterprisesuite/atlasenterprisesuite',
      requestedRef: 'feat/example'
    }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/execution/wf-ci-1'));
  });

  it('does not invent main when the requested ref is blank', async () => {
    render(
      <MemoryRouter initialEntries={['/execution/manager/sovereign-ci']}>
        <App />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Run verification' }));
    expect(startManagerSovereignCi).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Branch, tag, or SHA is required');
  });
});
