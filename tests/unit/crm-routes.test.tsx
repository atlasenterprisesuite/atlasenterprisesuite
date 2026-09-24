import React from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/web/src/modules/business/crm/crmApi', () => {
  class MockCrmApiError extends Error {
    status: number;
    code: string | null;
    retryAfterSeconds: number | null;
    constructor(input: { message: string; status: number; code?: string | null; retryAfterSeconds?: number | null }) {
      super(input.message);
      this.status = input.status;
      this.code = input.code ?? null;
      this.retryAfterSeconds = input.retryAfterSeconds ?? null;
    }
  }
  return {
    CrmApiError: MockCrmApiError,
    crmApi: vi.fn()
  };
});

import { AtlasShell } from '../../apps/web/src/components/AtlasShell';
import { CrmRoutes } from '../../apps/web/src/modules/business/crm/CrmRoutes';
import { crmApi } from '../../apps/web/src/modules/business/crm/crmApi';

const crmApiMock = vi.mocked(crmApi);
const resolverSource = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');
const integrationPageSource = readFileSync('apps/web/src/modules/business/crm/HubSpotIntegrationPage.tsx', 'utf8');

const connected = {
  provider: 'hubspot',
  state: 'connected',
  providerAccountId: '123456789',
  providerAccountLabel: 'HubSpot Test',
  grantedScopes: ['crm.objects.contacts.read'],
  lastVerifiedAt: '2026-09-15T12:00:00Z',
  lastSuccessAt: '2026-09-15T12:00:00Z',
  safeErrorCode: null
};

function connection(state: string) {
  return {
    ...connected,
    state,
    providerAccountId: state === 'unconfigured' ? null : connected.providerAccountId,
    providerAccountLabel: state === 'unconfigured' ? null : connected.providerAccountLabel,
    grantedScopes: state === 'unconfigured' ? [] : connected.grantedScopes,
    lastVerifiedAt: state === 'connected' ? connected.lastVerifiedAt : null,
    safeErrorCode: state === 'error' ? 'verification_failed' : null
  };
}

function defaultApi(operation: string, payload: Record<string, unknown> = {}) {
  if (operation === 'connection.status') return Promise.resolve({ connection: connected });
  if (operation === 'connection.health') return Promise.resolve({ health: {
    status: 'healthy',
    lastProbeAt: '2026-09-19T05:00:00Z',
    lastProbeSuccessAt: '2026-09-19T05:00:00Z',
    lastRefreshVerifiedAt: '2026-09-19T05:00:00Z',
    lastWebhookAt: null,
    lastReconcileAt: '2026-09-19T05:00:00Z',
    consecutiveFailures: 0,
    lastErrorCode: null,
    objectChecks: {},
    reconcileSummary: {}
  } });
  if (operation === 'connection.configuration') {
    return Promise.resolve({
      configured: true,
      redirectUri: 'https://atlas-test.supabase.co/functions/v1/atlas-crm-hubspot'
    });
  }
  if (operation === 'oauth.configure') {
    return Promise.resolve({
      configured: true,
      redirectUri: 'https://atlas-test.supabase.co/functions/v1/atlas-crm-hubspot'
    });
  }
  if (operation === 'connection.disconnect') return Promise.resolve({ connection: connection('revoked') });
  if (operation === 'crm.refresh') return Promise.resolve({ connection: connected, health: {
    status: 'healthy',
    lastProbeAt: '2026-09-19T05:00:00Z',
    lastProbeSuccessAt: '2026-09-19T05:00:00Z',
    lastRefreshVerifiedAt: '2026-09-19T05:00:00Z',
    lastWebhookAt: null,
    lastReconcileAt: '2026-09-19T05:00:00Z',
    consecutiveFailures: 0,
    lastErrorCode: null,
    objectChecks: {},
    reconcileSummary: {}
  } });
  if (operation === 'oauth.prepare') {
    return Promise.resolve({ authorizationUrl: 'https://app.hubspot.com/oauth/authorize?client_id=fake&state=fake' });
  }
  if (operation === 'crm.list' || operation === 'crm.search') {
    const objectType = String(payload.objectType ?? 'contact');
    return Promise.resolve({
      page: {
        records: [{
          provider: 'hubspot', objectType, providerId: '101',
          displayName: operation === 'crm.search' ? 'Search Result' : 'Example Record',
          fields: {}, updatedAt: '2026-09-15T11:00:00Z'
        }],
        nextCursor: operation === 'crm.list' && payload.cursor == null ? 'next-101' : null
      }
    });
  }
  if (operation === 'crm.get') {
    return Promise.resolve({
      record: {
        provider: 'hubspot', objectType: payload.objectType, providerId: payload.providerId,
        displayName: 'Example Contact', fields: { email: 'contact@example.test' },
        updatedAt: '2026-09-15T11:00:00Z'
      }
    });
  }
  if (operation === 'crm.associations') {
    return Promise.resolve({
      associations: {
        associations: payload.targetObjectType === 'company' ? [{
          provider: 'hubspot', fromObjectType: payload.objectType, fromProviderId: payload.providerId,
          toObjectType: 'company', toProviderId: '301', associationType: 'contact_to_company'
        }] : [],
        nextCursor: null
      }
    });
  }
  return Promise.resolve({});
}

beforeEach(() => {
  crmApiMock.mockImplementation((operation, payload) => defaultApi(operation, payload));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ATLAS CRM routing and provider-backed UI', () => {
  it('adds CRM to the canonical ATLAS shell navigation', () => {
    render(<MemoryRouter initialEntries={['/crm']}><AtlasShell><div>CRM route body</div></AtlasShell></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'CRM' })).toHaveAttribute('href', '/crm');
  });

  it.each([
    ['/crm', 'ATLAS CRM'], ['/crm/contacts', 'Contacts'], ['/crm/contacts/101', 'Contact'],
    ['/crm/companies', 'Accounts'], ['/crm/companies/201', 'Account'], ['/crm/deals', 'Opportunities'],
    ['/crm/deals/301', 'Opportunity'], ['/crm/service', 'Service Cases'], ['/crm/service/401', 'Service Case'],
    ['/crm/activities', 'Tasks'], ['/crm/integrations', 'Integrations'],
    ['/crm/integrations/hubspot', 'HubSpot Integration']
  ])('resolves %s to %s', (path, heading) => {
    // This contract only verifies routing. Keep provider effects pending so
    // async data updates do not leak beyond the synchronous route assertion.
    crmApiMock.mockImplementation(() => new Promise(() => {}));
    render(<MemoryRouter initialEntries={[path]}><CrmRoutes /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('mounts the CRM route family behind the existing identity guard', () => {
    expect(resolverSource).toContain("pathname === '/crm'");
    expect(resolverSource).toContain("pathname.startsWith('/crm/')");
    expect(resolverSource).toContain('<RequireAtlasIdentity>');
    expect(resolverSource).toContain('<CrmRoutes />');
  });

  it('shows loading and truthful empty states for provider records', async () => {
    crmApiMock.mockImplementation(() => new Promise(() => {}));
    render(<MemoryRouter initialEntries={['/crm/contacts']}><CrmRoutes /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Loading provider records');
    cleanup();

    crmApiMock.mockImplementation((operation, payload) => {
      if (operation === 'crm.list') return Promise.resolve({ page: { records: [], nextCursor: null } });
      return defaultApi(operation, payload);
    });
    render(<MemoryRouter initialEntries={['/crm/companies']}><CrmRoutes /></MemoryRouter>);
    expect(await screen.findByText('No provider records found')).toBeInTheDocument();
  });

  it('submits search to crm.search and preserves opaque pagination cursors', async () => {
    render(<MemoryRouter initialEntries={['/crm/contacts']}><CrmRoutes /></MemoryRouter>);
    await screen.findByText('Example Record');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Example query' } });
    fireEvent.submit(screen.getByRole('search'));
    await waitFor(() => expect(crmApiMock).toHaveBeenCalledWith('crm.search', expect.objectContaining({
      objectType: 'contact', query: 'Example query', cursor: null
    })));
    expect(await screen.findByText('Search Result')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await screen.findByText('Example Record');
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(crmApiMock).toHaveBeenCalledWith('crm.list', expect.objectContaining({
      objectType: 'contact', cursor: 'next-101'
    })));
  });

  it('renders degraded connection state as text, not color alone', async () => {
    crmApiMock.mockImplementation((operation, payload) => {
      if (operation === 'connection.status') return Promise.resolve({ connection: connection('degraded') });
      return defaultApi(operation, payload);
    });
    render(<MemoryRouter initialEntries={['/crm']}><CrmRoutes /></MemoryRouter>);
    expect(await screen.findByText('The provider is reachable, but one or more authorized CRM capabilities are unavailable.')).toBeInTheDocument();
  });

  it('renders provider source and associations while omitting absent fields', async () => {
    render(<MemoryRouter initialEntries={['/crm/contacts/101']}><CrmRoutes /></MemoryRouter>);
    expect(await screen.findByText('Source: HubSpot')).toBeInTheDocument();
    expect(screen.getByText('contact@example.test')).toBeInTheDocument();
    expect(screen.queryByText('Phone')).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'company 301' })).toHaveAttribute('href', '/crm/companies/301');
  });

  it('loads all association pages for a record', async () => {
    crmApiMock.mockImplementation((operation, payload) => {
      if (operation === 'crm.associations' && payload.targetObjectType === 'company') {
        if (payload.cursor === 'assoc-next') {
          return Promise.resolve({
            associations: {
              associations: [{
                provider: 'hubspot', fromObjectType: payload.objectType, fromProviderId: payload.providerId,
                toObjectType: 'company', toProviderId: '302', associationType: 'contact_to_company'
              }],
              nextCursor: null
            }
          });
        }
        return Promise.resolve({
          associations: {
            associations: [{
              provider: 'hubspot', fromObjectType: payload.objectType, fromProviderId: payload.providerId,
              toObjectType: 'company', toProviderId: '301', associationType: 'contact_to_company'
            }],
            nextCursor: 'assoc-next'
          }
        });
      }
      return defaultApi(operation, payload);
    });

    render(<MemoryRouter initialEntries={['/crm/contacts/101']}><CrmRoutes /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'company 301' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'company 302' })).toBeInTheDocument();
    await waitFor(() => expect(crmApiMock).toHaveBeenCalledWith(
      'crm.associations',
      expect.objectContaining({ targetObjectType: 'company', cursor: 'assoc-next' })
    ));
  });
});

describe('HubSpot connection controls', () => {
  it.each([
    ['unconfigured', 'Not configured'], ['authorizing', 'Authorizing'], ['connected', 'Connected'],
    ['degraded', 'Degraded'], ['expired', 'Expired'], ['revoked', 'Revoked'], ['error', 'Error']
  ])('renders %s as the truthful %s state', async (state, label) => {
    crmApiMock.mockImplementation((operation, payload) => {
      if (operation === 'connection.status') return Promise.resolve({ connection: connection(state) });
      return defaultApi(operation, payload);
    });
    render(<MemoryRouter initialEntries={['/crm/integrations/hubspot']}><CrmRoutes /></MemoryRouter>);
    expect((await screen.findAllByText(label)).length).toBeGreaterThan(0);
  });

  it('keeps provider credentials out of browser persistence', () => {
    expect(integrationPageSource).not.toContain('accessToken');
    expect(integrationPageSource).not.toContain('refreshToken');
    expect(integrationPageSource).not.toContain('localStorage');
    expect(integrationPageSource).not.toContain('sessionStorage');
    expect(integrationPageSource).toContain('type="password"');
    expect(integrationPageSource).toContain('autoComplete="new-password"');
  });

  it('offers secure OAuth setup when backend configuration is absent', async () => {
    crmApiMock.mockImplementation((operation, payload) => {
      if (operation === 'connection.configuration') {
        return Promise.resolve({
          configured: false,
          redirectUri: 'https://atlas-test.supabase.co/functions/v1/atlas-crm-hubspot'
        });
      }
      return defaultApi(operation, payload);
    });

    render(<MemoryRouter initialEntries={['/crm/integrations/hubspot']}><CrmRoutes /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'HubSpot OAuth app setup' })).toBeInTheDocument();
    expect(screen.getByText('https://atlas-test.supabase.co/functions/v1/atlas-crm-hubspot')).toBeInTheDocument();

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'client-id-1' } });
    const secretInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(secretInput, { target: { value: 'client-secret-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save OAuth configuration' }));

    await waitFor(() => expect(crmApiMock).toHaveBeenCalledWith('oauth.configure', {
      clientId: 'client-id-1',
      clientSecret: 'client-secret-123'
    }));
  });

  it('renders production resilience health without exposing provider secrets', async () => {
    render(<MemoryRouter initialEntries={['/crm/integrations/hubspot']}><CrmRoutes /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Production resilience' })).toBeInTheDocument();
    expect(screen.getByText('healthy')).toBeInTheDocument();
    expect(screen.getByText(/Outbound HubSpot writes remain disabled/)).toBeInTheDocument();
    expect(integrationPageSource).not.toContain('refreshToken');
    expect(integrationPageSource).not.toContain('accessToken');
  });

  it('allows configured OAuth credentials to be securely replaced', async () => {
    render(<MemoryRouter initialEntries={['/crm/integrations/hubspot']}><CrmRoutes /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Replace HubSpot OAuth credentials' })).toBeInTheDocument();

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'correct-client-id' } });
    const secretInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(secretInput, { target: { value: 'correct-client-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Replace OAuth configuration' }));

    await waitFor(() => expect(crmApiMock).toHaveBeenCalledWith('oauth.configure', {
      clientId: 'correct-client-id',
      clientSecret: 'correct-client-secret'
    }));
    expect(textboxes[0]).toHaveValue('');
    expect(secretInput).toHaveValue('');
  });

  it('disables Connect while authorization preparation is pending', async () => {
    crmApiMock.mockImplementation((operation, payload) => {
      if (operation === 'oauth.prepare') return new Promise(() => {});
      return defaultApi(operation, payload);
    });
    render(<MemoryRouter initialEntries={['/crm/integrations/hubspot']}><CrmRoutes /></MemoryRouter>);
    const connectButton = await screen.findByRole('button', { name: 'Reconnect HubSpot' });
    fireEvent.click(connectButton);
    expect(screen.getByRole('button', { name: 'Authorizing…' })).toBeDisabled();
  });

  it('requires explicit confirmation and can cancel disconnect', async () => {
    render(<MemoryRouter initialEntries={['/crm/integrations/hubspot']}><CrmRoutes /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect HubSpot' }));
    expect(screen.getByRole('dialog', { name: 'Disconnect HubSpot?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Disconnect HubSpot?' })).not.toBeInTheDocument();
    expect(crmApiMock).not.toHaveBeenCalledWith('connection.disconnect', expect.anything());
  });

  it('keeps prior state on failed disconnect and reports the error', async () => {
    crmApiMock.mockImplementation((operation, payload) => {
      if (operation === 'connection.disconnect') return Promise.reject(new Error('provider unavailable'));
      return defaultApi(operation, payload);
    });
    render(<MemoryRouter initialEntries={['/crm/integrations/hubspot']}><CrmRoutes /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect HubSpot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('HubSpot connection operation failed');
    expect((await screen.findAllByText('Connected')).length).toBeGreaterThan(0);
  });

  it('renders Revoked only after the backend confirms successful disconnect', async () => {
    render(<MemoryRouter initialEntries={['/crm/integrations/hubspot']}><CrmRoutes /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect HubSpot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(crmApiMock).toHaveBeenCalledWith('connection.disconnect'));
    expect((await screen.findAllByText('Revoked')).length).toBeGreaterThan(0);
  });
});
