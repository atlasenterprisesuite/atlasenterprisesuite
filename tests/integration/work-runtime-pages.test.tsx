import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkConnectionsPage } from '../../apps/web/src/work/WorkConnectionsPage';
import { WorkRuntimesPage } from '../../apps/web/src/work/WorkRuntimesPage';
import { WorkPoliciesPage } from '../../apps/web/src/work/WorkPoliciesPage';
import {
  enrollWorkRuntime,
  listWorkConnections,
  listWorkRuntimes,
  registerWorkConnectionRef,
  revokeWorkConnectionRef
} from '../../apps/web/src/work/api';

vi.mock('../../apps/web/src/work/api', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/work/api')>('../../apps/web/src/work/api');
  return {
    ...actual,
    listWorkConnections: vi.fn(),
    listWorkRuntimes: vi.fn(),
    registerWorkConnectionRef: vi.fn(),
    revokeWorkConnectionRef: vi.fn(),
    enrollWorkRuntime: vi.fn()
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listWorkConnections).mockResolvedValue([]);
  vi.mocked(listWorkRuntimes).mockResolvedValue([]);
});

describe('ATLAS Work runtime support pages', () => {
  it('renders a truthful empty connection state', async () => {
    render(<MemoryRouter><WorkConnectionsPage /></MemoryRouter>);
    expect(await screen.findByText('No authorized Work connections are registered for this organization.')).toBeInTheDocument();
  });

  it('registers an opaque connection reference through the real Work API', async () => {
    vi.mocked(registerWorkConnectionRef).mockResolvedValue({
      id: 'c1',
      provider: 'cloudflare',
      mechanism: 'oauth',
      status: 'active',
      capabilities: ['dns.read', 'dns.write.txt']
    });
    vi.mocked(listWorkConnections)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'c1', provider: 'cloudflare', mechanism: 'oauth', status: 'active', capabilities: ['dns.read', 'dns.write.txt'] }]);

    render(<MemoryRouter><WorkConnectionsPage /></MemoryRouter>);
    await screen.findByText('No authorized Work connections are registered for this organization.');

    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'Cloudflare' } });
    fireEvent.change(screen.getByLabelText('Connection reference'), { target: { value: 'provider-ref-1' } });
    fireEvent.change(screen.getByLabelText('Capabilities'), { target: { value: 'dns.read, dns.write.txt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register connection' }));

    await waitFor(() => expect(registerWorkConnectionRef).toHaveBeenCalledWith({
      provider: 'cloudflare',
      mechanism: 'oauth',
      externalRef: 'provider-ref-1',
      capabilities: ['dns.read', 'dns.write.txt']
    }));
    expect(await screen.findByText('Connection reference registered for this organization.')).toBeInTheDocument();
    expect(screen.getByText('cloudflare')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('provider-ref-1');
  });

  it('revokes active connection references from the Work surface', async () => {
    vi.mocked(listWorkConnections)
      .mockResolvedValueOnce([{ id: 'c1', provider: 'cloudflare', mechanism: 'oauth', status: 'active', capabilities: ['dns.read'] }])
      .mockResolvedValueOnce([{ id: 'c1', provider: 'cloudflare', mechanism: 'oauth', status: 'revoked', capabilities: ['dns.read'] }]);
    vi.mocked(revokeWorkConnectionRef).mockResolvedValue({ ok: true });

    render(<MemoryRouter><WorkConnectionsPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke connection' }));

    await waitFor(() => expect(revokeWorkConnectionRef).toHaveBeenCalledWith('c1'));
    expect(await screen.findByText('Connection reference revoked.')).toBeInTheDocument();
    expect(screen.getByText('revoked')).toBeInTheDocument();
  });

  it('renders safe connection metadata only', async () => {
    vi.mocked(listWorkConnections).mockResolvedValue([{ id: 'c1', provider: 'cloudflare', mechanism: 'oauth', status: 'active', capabilities: ['dns.read', 'dns.write.txt'] }]);
    render(<MemoryRouter><WorkConnectionsPage /></MemoryRouter>);
    expect(await screen.findByText('cloudflare')).toBeInTheDocument();
    expect(screen.getByText('oauth')).toBeInTheDocument();
    expect(JSON.stringify(document.body.textContent)).not.toMatch(/auth_token_hash/i);
  });

  it('enrolls a runtime and exposes its token only as a one-time in-memory result', async () => {
    const runtime = { id: 'r1', kind: 'local' as const, label: 'ATLAS Local Agent', status: 'offline' as const, capabilities: ['browser'], lastSeenAt: null };
    vi.mocked(enrollWorkRuntime).mockResolvedValue({ runtime, runtimeToken: 'one-time-runtime-token' });
    vi.mocked(listWorkRuntimes).mockResolvedValueOnce([]).mockResolvedValueOnce([runtime]);

    render(<MemoryRouter><WorkRuntimesPage /></MemoryRouter>);
    await screen.findByText('No Work runtimes are registered for this organization.');
    fireEvent.change(screen.getByLabelText('Runtime label'), { target: { value: 'ATLAS Local Agent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enroll runtime' }));

    await waitFor(() => expect(enrollWorkRuntime).toHaveBeenCalledWith({
      kind: 'local',
      label: 'ATLAS Local Agent',
      capabilities: ['browser']
    }));
    expect(await screen.findByText('one-time-runtime-token')).toBeInTheDocument();
    expect(screen.getByText('Runtime enrolled. It remains offline until its authenticated heartbeat is received.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'I have saved it securely' }));
    expect(screen.queryByText('one-time-runtime-token')).not.toBeInTheDocument();
  });

  it('marks a persisted online runtime stale when its heartbeat is outside the readiness window', async () => {
    vi.mocked(listWorkRuntimes).mockResolvedValue([{
      id: 'r1',
      kind: 'self_hosted',
      label: 'ATLAS Runner',
      status: 'online',
      capabilities: ['browser'],
      lastSeenAt: '2026-09-12T21:00:00Z'
    }]);
    render(<MemoryRouter><WorkRuntimesPage /></MemoryRouter>);
    expect(await screen.findByText('ATLAS Runner')).toBeInTheDocument();
    expect(screen.getByText('self hosted')).toBeInTheDocument();
    expect(screen.getByText('stale')).toBeInTheDocument();
    expect(screen.getByText(/older than the canonical 120-second readiness window/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/auth_token_hash/i);
  });

  it('shows the fail-closed default policy', () => {
    render(<MemoryRouter><WorkPoliciesPage /></MemoryRouter>);
    expect(screen.getByText('Hybrid')).toBeInTheDocument();
    expect(screen.getByText('Guided')).toBeInTheDocument();
    expect(screen.getByText('Auto')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
  });
});
