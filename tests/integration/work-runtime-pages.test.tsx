import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkConnectionsPage } from '../../apps/web/src/work/WorkConnectionsPage';
import { WorkRuntimesPage } from '../../apps/web/src/work/WorkRuntimesPage';
import { WorkPoliciesPage } from '../../apps/web/src/work/WorkPoliciesPage';
import { enrollWorkRuntime, listWorkConnections, listWorkRuntimes } from '../../apps/web/src/work/api';

vi.mock('../../apps/web/src/work/api', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/work/api')>('../../apps/web/src/work/api');
  return { ...actual, enrollWorkRuntime: vi.fn(), listWorkConnections: vi.fn(), listWorkRuntimes: vi.fn() };
});

beforeEach(() => vi.clearAllMocks());

describe('ATLAS Work runtime support pages', () => {
  it('renders a truthful empty connection state', async () => {
    vi.mocked(listWorkConnections).mockResolvedValue([]);
    render(<MemoryRouter><WorkConnectionsPage /></MemoryRouter>);
    expect(await screen.findByText('No authorized Work connections are registered for this organization.')).toBeInTheDocument();
  });

  it('renders safe connection metadata only', async () => {
    vi.mocked(listWorkConnections).mockResolvedValue([{ id: 'c1', provider: 'cloudflare', mechanism: 'oauth', status: 'active', capabilities: ['dns.read', 'dns.write.txt'] }]);
    render(<MemoryRouter><WorkConnectionsPage /></MemoryRouter>);
    expect(await screen.findByText('cloudflare')).toBeInTheDocument();
    expect(screen.getByText('oauth')).toBeInTheDocument();
    expect(JSON.stringify(document.body.textContent)).not.toMatch(/token|hash/i);
  });

  it('renders runtime health without auth material', async () => {
    vi.mocked(listWorkRuntimes).mockResolvedValue([{ id: 'r1', kind: 'self_hosted', label: 'ATLAS Runner', status: 'online', capabilities: ['browser'], lastSeenAt: '2026-09-12T21:00:00Z' }]);
    render(<MemoryRouter><WorkRuntimesPage /></MemoryRouter>);
    expect(await screen.findByText('ATLAS Runner')).toBeInTheDocument();
    expect(screen.getByText('self hosted')).toBeInTheDocument();
    expect(screen.getByText('online')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/auth_token_hash/i);
  });

  it('enrolls a governed browser runtime and reveals the token only in the one-time setup state', async () => {
    vi.mocked(listWorkRuntimes).mockResolvedValue([]);
    vi.mocked(enrollWorkRuntime).mockResolvedValue({
      runtime: { id: 'runtime-123', kind: 'local', label: 'ATLAS Governed Browser', status: 'offline', capabilities: ['browser'] },
      runtime_token: 'one-time-runtime-token'
    });
    render(<MemoryRouter><WorkRuntimesPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Enroll Browser Runtime' }));
    expect(await screen.findByText(/Save this token now/)).toBeInTheDocument();
    expect(screen.getByText(/ATLAS_WORK_RUNTIME_ID=runtime-123/)).toBeInTheDocument();
    expect(screen.getByText(/ATLAS_WORK_RUNTIME_TOKEN=one-time-runtime-token/)).toBeInTheDocument();
    expect(enrollWorkRuntime).toHaveBeenCalledWith({
      kind: 'local',
      label: 'ATLAS Governed Browser',
      capabilities: ['browser']
    });
  });

  it('shows the fail-closed default policy', () => {
    render(<MemoryRouter><WorkPoliciesPage /></MemoryRouter>);
    expect(screen.getByText('Hybrid')).toBeInTheDocument();
    expect(screen.getByText('Guided')).toBeInTheDocument();
    expect(screen.getByText('Auto')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
  });
});
