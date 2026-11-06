import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import { clearAtlasSession } from '../../apps/web/src/lib/atlasSession';

// Isolate the Device OS preview: existing networked control-plane panels are
// covered separately and must not be invoked by this visual simulation test.
vi.mock('../../apps/web/src/modules/device-os/LocalNetworkAccessPanel', () => ({
  LocalNetworkAccessPanel: () => null
}));
vi.mock('../../apps/web/src/modules/device-os/LocalControlPlanePanel', () => ({
  LocalControlPlanePanel: () => null
}));
vi.mock('../../apps/web/src/modules/device-os/LocalCorePanel', () => ({
  LocalCorePanel: () => null
}));
vi.mock('../../apps/web/src/modules/device-os/DeviceEvolutionPanel', () => ({
  DeviceEvolutionPanel: () => null
}));
vi.mock('../../apps/web/src/modules/device-os/RemoteAssistPanel', () => ({
  RemoteAssistPanel: () => null
}));

afterEach(() => {
  cleanup();
  clearAtlasSession();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ATLAS Device OS Glasses preview through the existing Identity gate', () => {
  it('does not expose Device OS to an unauthenticated visitor', async () => {
    render(<MemoryRouter initialEntries={['/device-os']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'ATLAS Identity' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'One Core. Every Device.' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Glasses experience preview' })).not.toBeInTheDocument();
  });

  it('authenticates with a synthetic organization and switches all three local scenes without requesting device permissions', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'synthetic-preview-token', refresh_token: 'synthetic-preview-refresh'
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { org_id: 'org-1', role: 'owner', status: 'active' }
      ]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/identity?app=%2Fdevice-os']}>
        <App />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'preview@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'synthetic-not-a-real-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to ATLAS' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'One Core. Every Device.' })).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Glasses experience preview' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ATLAS Glasses/i }));
    expect(screen.getByRole('heading', { name: 'Glasses experience preview' })).toBeInTheDocument();
    expect(screen.getByText('SIMULATION ONLY')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Enterprise cockpit' })).toBeInTheDocument();
    const initialCalls = fetchMock.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Navigation' }));
    expect(screen.getByRole('button', { name: 'Navigation' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Spatial wayfinding' })).toBeInTheDocument();
    expect(screen.getByText('Location: unavailable')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Assistant' }));
    expect(screen.getByRole('heading', { name: 'Contextual assistance' })).toBeInTheDocument();
    expect(screen.getByText('Microphone: off')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }));
    expect(screen.getByRole('heading', { name: 'Enterprise cockpit' })).toBeInTheDocument();
    expect(screen.getByText('Actions: disabled')).toBeInTheDocument();

    // The preview must not initiate requests to remote services or hardware.
    expect(fetchMock).toHaveBeenCalledTimes(initialCalls);
  });
});
