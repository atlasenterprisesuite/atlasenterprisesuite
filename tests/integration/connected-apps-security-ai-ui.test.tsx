import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/web/src/lib/connectedAppsApi', () => ({
  loadExternalAccess: vi.fn(async () => ({
    connections: [{ id: 'c1', provider: 'hubspot', displayName: 'HubSpot', status: 'degraded', highRiskCapabilities: ['crm.deals.write'], policyEffect: 'approval_required' }],
    recentDecisions: [{ id: 'e1', provider: 'hubspot', capabilityCode: 'crm.deals.write', decision: 'approval_required' }],
    retentionExceptions: []
  })),
  listAssistantConnectedApps: vi.fn(async () => ({
    apps: [{ providerId: 'hubspot', displayName: 'HubSpot', accountLabel: 'ATLAS CRM', health: 'connected', capabilities: [{ code: 'crm.contacts.read', approvalRequired: false }], verifiedAt: '2026-10-05T12:00:00Z' }]
  }))
}));

import { ExternalAccessPage } from '../../apps/web/src/modules/connected-apps/ExternalAccessPage';
import { AssistantAppsPage } from '../../apps/web/src/modules/connected-apps/AssistantAppsPage';

describe('Connected Apps Security and Assistant surfaces', () => {
  it('shows governance risk and approval state without provider secrets', async () => {
    render(<MemoryRouter><ExternalAccessPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('HubSpot')).toBeInTheDocument());
    expect(screen.getByText(/degraded/i)).toBeInTheDocument();
    expect(screen.getAllByText(/approval required/i).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/access[_ -]?token|refresh[_ -]?token|client[_ -]?secret/i);
  });

  it('shows only server-filtered assistant capabilities and their approval boundary', async () => {
    render(<MemoryRouter><AssistantAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('ATLAS CRM')).toBeInTheDocument());
    expect(screen.getByText('crm.contacts.read')).toBeInTheDocument();
    expect(screen.getByText(/No approval required/i)).toBeInTheDocument();
  });
});
