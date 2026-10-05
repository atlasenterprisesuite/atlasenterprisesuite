import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/web/src/lib/connectedAppsApi', () => ({
  listConnectedApps: vi.fn(async () => ({
    apps: [
      { providerId: 'hubspot', displayName: 'HubSpot', runtimeStatus: 'ready', status: 'connected', accountLabel: 'ATLAS CRM', capabilities: [{ code: 'crm.contacts.read', usable: true }], lastVerifiedAt: '2026-10-05T12:00:00Z' },
      { providerId: 'google', displayName: 'Google Workspace', runtimeStatus: 'catalog_only', status: 'disconnected', accountLabel: null, capabilities: [], lastVerifiedAt: null },
      { providerId: 'scope-test', displayName: 'Scope Test', runtimeStatus: 'ready', status: 'connected', accountLabel: 'Scoped', capabilities: [{ code: 'mail.send', usable: false, missingScopes: ['mail.send'] }], lastVerifiedAt: null }
    ]
  }))
}));

import { ConnectedAppsPage } from '../../apps/web/src/modules/connected-apps/ConnectedAppsPage';

describe('Connected Apps Settings UI', () => {
  it('renders truthful connected catalog-only and missing-scope states', async () => {
    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('HubSpot')).toBeInTheDocument());
    expect(screen.getByText('ATLAS CRM')).toBeInTheDocument();
    expect(screen.getByText('Google Workspace')).toBeInTheDocument();
    expect(screen.getByText(/Catalog only/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing scope/i)).toBeInTheDocument();
    expect(screen.getByText('mail.send')).toBeInTheDocument();
  });

  it('exposes keyboard-focusable lifecycle actions without pretending catalog-only apps are connected', async () => {
    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('link', { name: /Manage HubSpot/i })).toBeInTheDocument());
    const google = screen.getByTestId('connected-app-google');
    expect(google).toHaveTextContent(/Disconnected/i);
    expect(google).not.toHaveTextContent(/Connected account/i);
  });
});
