import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';

// Identity is synthetic and isolated. No production tokens or external requests.
const mocks = vi.hoisted(() => ({
  organization: vi.fn(),
  status: vi.fn(),
  usage: vi.fn()
}));

vi.mock('../../apps/web/src/lib/atlasSession', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/lib/atlasSession')>('../../apps/web/src/lib/atlasSession');
  return { ...actual, getActiveAtlasOrganization: mocks.organization };
});

vi.mock('../../apps/web/src/assistant/client', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/assistant/client')>('../../apps/web/src/assistant/client');
  return { ...actual, getAssistantStatus: mocks.status, getAssistantUsage: mocks.usage };
});

const scopedStatus = (org: string) => ({
  ok: true, authenticated: true, organization: org, role: 'owner',
  provider: 'atlas-local', provider_state: 'verified_for_request', model: null,
  storage_state: 'configured', capabilities: [],
  providers: [{ id: 'atlas-local', state: 'verified', configured: true, verified: true,
    model: null, capabilities: [], profiles: ['balanced'], error: null }]
});

const usage = {
  ok: true, scope: 'organization', days: 30,
  period_start: '2026-10-07T00:00:00Z', period_end: '2026-11-06T00:00:00Z',
  total_requests: 13, completed_requests: 12, failed_requests: 1, average_latency_ms: 100,
  automatic_api_cost_usd: 0, tokens: { input: 0, output: 0, total: 0 },
  providers: [], models: []
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.organization.mockResolvedValue({ id: 'org-a', role: 'owner' });
  mocks.status.mockResolvedValue(scopedStatus('org-a'));
  mocks.usage.mockResolvedValue(usage);
});

afterEach(() => {
  localStorage.clear();
});

describe('ATLAS MAX /max authenticated route synthetic identity fixture', () => {
  it('redirects to canonical identity route when access token is absent', async () => {
    render(<MemoryRouter initialEntries={['/max']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'ATLAS Identity' })).toBeInTheDocument();
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.usage).not.toHaveBeenCalled();
  });

  it('renders authenticated organization-scoped Gateway evidence, without activating paid MAX', async () => {
    localStorage.setItem('atlas_access_token', 'synthetic-test-token-NOT-FOR-PRODUCTION');
    render(<MemoryRouter initialEntries={['/max']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'ATLAS MAX', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Authenticated snapshot')).toBeInTheDocument();
    expect(screen.getByText('atlas-local')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/status unavailable/i);
    expect(mocks.organization).toHaveBeenCalled();
    expect(mocks.status).toHaveBeenCalled();
    expect(mocks.usage).toHaveBeenCalledWith(30);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('hides cross-organization status even when the synthetic identity fixture is authorized', async () => {
    localStorage.setItem('atlas_access_token', 'synthetic-test-token-NOT-FOR-PRODUCTION');
    mocks.status.mockResolvedValue(scopedStatus('org-b'));
    render(<MemoryRouter initialEntries={['/max']}><App /></MemoryRouter>);
    expect(await screen.findByText('No verified readiness can be displayed at this time.')).toBeInTheDocument();
    expect(screen.queryByText('atlas-local')).not.toBeInTheDocument();
    expect(screen.queryByText('13')).not.toBeInTheDocument();
  });

  it('denies revoked membership before showing the workspace', async () => {
    localStorage.setItem('atlas_access_token', 'synthetic-test-token-NOT-FOR-PRODUCTION');
    mocks.organization.mockRejectedValue(new Error('membership_revoked'));
    render(<MemoryRouter initialEntries={['/max']}><App /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'ATLAS Identity' })).toBeInTheDocument());
    expect(screen.queryByText('Authenticated snapshot')).not.toBeInTheDocument();
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it('refreshes authenticated provider status via the visible control without enabling a subscription', async () => {
    localStorage.setItem('atlas_access_token', 'synthetic-test-token-NOT-FOR-PRODUCTION');
    render(<MemoryRouter initialEntries={['/max']}><App /></MemoryRouter>);
    expect(await screen.findByText('Authenticated snapshot')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh gateway evidence' }));
    await waitFor(() => expect(mocks.status.mock.calls.length).toBeGreaterThan(1));
    expect(screen.getByRole('status')).toHaveTextContent(/status unavailable/i);
  });
});
