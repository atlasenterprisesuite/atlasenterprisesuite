import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getActiveAtlasOrganization: vi.fn(),
  getAssistantStatus: vi.fn(),
  getAssistantUsage: vi.fn()
}));

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  ATLAS_SESSION_EVENT: 'atlas-session-changed',
  getActiveAtlasOrganization: mocks.getActiveAtlasOrganization
}));
vi.mock('../../apps/web/src/assistant/client', () => ({
  getAssistantStatus: mocks.getAssistantStatus,
  getAssistantUsage: mocks.getAssistantUsage
}));

import { AtlasMaxRoutePage } from '../../apps/web/src/modules/atlas-max/AtlasMaxRoutePage';

const status = {
  ok: true, authenticated: true, organization: 'org-a',
  provider: 'atlas-local', provider_state: 'verified_for_request', model: null,
  role: 'owner', storage_state: 'configured', capabilities: [],
  providers: [{ id: 'atlas-local', state: 'verified', verified: true, configured: true, model: null, capabilities: [], profiles: [], error: null }]
};
const usage = {
  ok: true, scope: 'organization', days: 30, period_start: '2026-10-01', period_end: '2026-10-31',
  total_requests: 4, completed_requests: 4, failed_requests: 0,
  average_latency_ms: 1, automatic_api_cost_usd: 0,
  tokens: { input: 0, output: 0, total: 0 }, providers: [], models: []
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getActiveAtlasOrganization.mockResolvedValue({ id: 'org-a', role: 'owner' });
  mocks.getAssistantStatus.mockResolvedValue(status);
  mocks.getAssistantUsage.mockResolvedValue(usage);
});
afterEach(cleanup);

describe('ATLAS MAX authenticated route', () => {
  it('uses existing Copilot APIs and never treats gateway status as MAX entitlement', async () => {
    render(<AtlasMaxRoutePage />);
    expect(await screen.findByText('Authenticated snapshot')).toBeInTheDocument();
    expect(screen.getByText('atlas-local')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(mocks.getAssistantStatus).toHaveBeenCalled();
    expect(mocks.getAssistantUsage).toHaveBeenCalledWith(30);
    expect(screen.getByRole('status')).toHaveTextContent(/status unavailable/i);
  });

  it('fails closed on a returned organization mismatch', async () => {
    mocks.getAssistantStatus.mockResolvedValue({ ...status, organization: 'org-b' });
    render(<AtlasMaxRoutePage />);
    expect(await screen.findByText('No verified readiness can be displayed at this time.')).toBeInTheDocument();
    expect(screen.queryByText('atlas-local')).not.toBeInTheDocument();
  });

  it('preserves provider readiness if metering is unavailable', async () => {
    mocks.getAssistantUsage.mockRejectedValue(new Error('service unavailable'));
    render(<AtlasMaxRoutePage />);
    expect(await screen.findByText('Authenticated snapshot')).toBeInTheDocument();
    expect(screen.getByText(/Usage history unavailable or not verified/i)).toBeInTheDocument();
  });
});
