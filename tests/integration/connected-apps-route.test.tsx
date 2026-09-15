import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import { resolveAtlasIdentityTarget } from '../../apps/web/src/identity/IdentityPage';
import { ConnectedAppsRoutes } from '../../apps/web/src/modules/settings/connected-apps/ConnectedAppsRoutes';
import * as integrationsApi from '../../apps/web/src/lib/integrationsApi';

vi.mock('../../apps/web/src/lib/integrationsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../apps/web/src/lib/integrationsApi')>();
  return {
    ...actual,
    listIntegrationConnections: vi.fn(),
    getIntegrationConnection: vi.fn(),
    beginIntegrationAuthorization: vi.fn(),
    verifyIntegration: vi.fn(),
    executeIntegrationCapability: vi.fn(),
    revokeIntegration: vi.fn(),
    listIntegrationGrants: vi.fn(),
    grantIntegrationCapability: vi.fn(),
    revokeIntegrationGrant: vi.fn(),
    listIntegrationActivity: vi.fn()
  };
});

const listConnections = vi.mocked(integrationsApi.listIntegrationConnections);
const getConnection = vi.mocked(integrationsApi.getIntegrationConnection);
const listGrants = vi.mocked(integrationsApi.listIntegrationGrants);
const listActivity = vi.mocked(integrationsApi.listIntegrationActivity);

const verifiedConnection: integrationsApi.BrowserIntegrationConnection = {
  id: 'connection-1',
  providerKey: 'microsoft',
  status: 'verified',
  maskedIdentity: 'w***u@hotmail.com',
  connectedAt: '2026-09-15T16:00:00.000Z',
  lastVerifiedAt: '2026-09-15T16:10:00.000Z',
  expiresAt: '2026-09-15T17:10:00.000Z',
  scopes: ['openid', 'profile', 'email', 'offline_access', 'User.Read'],
  connectorClass: 'user_oauth',
  environment: null,
  lastErrorCode: null
};

function renderConnectedApps(path = '/settings/security/connected-apps') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ConnectedAppsRoutes />
    </MemoryRouter>
  );
}

describe('ATLAS Connected Apps settings experience', () => {
  beforeEach(() => {
    window.localStorage.clear();
    listConnections.mockReset();
    getConnection.mockReset();
    listGrants.mockReset();
    listActivity.mockReset();
    listConnections.mockResolvedValue([]);
    getConnection.mockResolvedValue(null);
    listGrants.mockResolvedValue([]);
    listActivity.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('routes unauthenticated settings access through ATLAS Identity and preserves the return target', async () => {
    expect(resolveAtlasIdentityTarget('/settings/security/connected-apps')).toBe('/settings/security/connected-apps');

    render(
      <MemoryRouter initialEntries={['/settings/security/connected-apps']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'ATLAS Identity' })).toBeInTheDocument();
    expect(screen.getByText('/settings/security/connected-apps')).toBeInTheDocument();
  });

  it('renders a truthful provider catalog with Microsoft connectable and other providers unconfigured', async () => {
    renderConnectedApps();

    expect(await screen.findByRole('heading', { name: 'Connected Apps' })).toBeInTheDocument();
    for (const provider of ['Microsoft', 'Google', 'GitHub', 'Cloudflare', 'Supabase']) {
      expect(screen.getByText(provider)).toBeInTheDocument();
    }
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Microsoft' })).toBeEnabled();
    expect(screen.getAllByText('Not configured').length).toBeGreaterThanOrEqual(4);
  });

  it('never labels connected_unverified as Verified', async () => {
    listConnections.mockResolvedValue([{ ...verifiedConnection, status: 'connected_unverified', lastVerifiedAt: null }]);

    renderConnectedApps();

    expect(await screen.findByText('Connected · verification required')).toBeInTheDocument();
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
  });

  it('renders verified Microsoft detail with masked identity and all governed tabs', async () => {
    getConnection.mockResolvedValue(verifiedConnection);

    renderConnectedApps('/settings/security/connected-apps/microsoft');

    expect(await screen.findByRole('heading', { name: 'Microsoft' })).toBeInTheDocument();
    expect(screen.getByText('Verified', { selector: '.connected-app-status' })).toBeInTheDocument();
    expect(screen.getByText('w***u@hotmail.com')).toBeInTheDocument();
    for (const tab of ['Overview', 'Permissions', 'Used By', 'Activity', 'Security']) {
      expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument();
    }
  });

  it('loads real Used By grants and Activity records from the gateway', async () => {
    getConnection.mockResolvedValue(verifiedConnection);
    listGrants.mockResolvedValue([
      {
        id: 'grant-1',
        principalType: 'user',
        principalId: 'user-1',
        module: 'settings',
        capability: 'microsoft.profile.read',
        grantedAt: '2026-09-15T16:20:00.000Z'
      }
    ]);
    listActivity.mockResolvedValue([
      {
        id: 'event-1',
        action: 'grant_created',
        outcome: 'succeeded',
        module: 'settings',
        statusBefore: null,
        statusAfter: null,
        capability: 'microsoft.profile.read',
        createdAt: '2026-09-15T16:21:00.000Z'
      }
    ]);

    renderConnectedApps('/settings/security/connected-apps/microsoft');
    expect(await screen.findByRole('heading', { name: 'Microsoft' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Used By' }));
    expect(await screen.findByText('microsoft.profile.read')).toBeInTheDocument();
    expect(screen.getByText('settings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke grant microsoft.profile.read' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(await screen.findByText('grant_created')).toBeInTheDocument();
    expect(screen.getByText('succeeded')).toBeInTheDocument();
  });

  it('allow-lists browser DTO fields and discards malicious token-shaped response keys', () => {
    const normalized = integrationsApi.normalizeIntegrationConnection({
      id: 'connection-1',
      provider: 'microsoft',
      state: 'verified',
      provider_account_label: 'w***u@hotmail.com',
      granted_scopes: ['User.Read'],
      access_token: 'secret-access-token',
      refresh_token: 'secret-refresh-token',
      metadata: { client_secret: 'do-not-render' }
    });

    expect(normalized).toMatchObject({ providerKey: 'microsoft', status: 'verified', maskedIdentity: 'w***u@hotmail.com' });
    expect(JSON.stringify(normalized)).not.toContain('secret-access-token');
    expect(JSON.stringify(normalized)).not.toContain('secret-refresh-token');
    expect(JSON.stringify(normalized)).not.toContain('do-not-render');
  });
});
