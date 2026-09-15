import { describe, expect, it } from 'vitest';
import {
  canReportConnected,
  createIntegrationConnection,
  hasLegacyIntegrationAdmin,
  hasPermission
} from '../../packages/core/src/index';

describe('ATLAS CRM core contracts', () => {
  it('supports HubSpot as an integration provider', () => {
    expect(
      createIntegrationConnection({
        scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
        provider: 'hubspot'
      })
    ).toEqual({
      scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
      provider: 'hubspot',
      status: 'disconnected'
    });
  });

  it('keeps CRM permissions inside the CRM namespace', () => {
    expect(hasPermission(['crm.admin'], 'crm.read')).toBe(true);
    expect(hasPermission(['crm.admin'], 'crm.sync')).toBe(true);
    expect(hasPermission(['integrations.admin'], 'crm.read')).toBe(false);
    expect(hasPermission(['accounting.admin'], 'crm.read')).toBe(false);
  });

  it('recognizes legacy integration manage only as an integration-admin compatibility alias', () => {
    expect(hasLegacyIntegrationAdmin(['integrations.manage'])).toBe(true);
    expect(hasLegacyIntegrationAdmin(['integrations.admin'])).toBe(true);
    expect(hasLegacyIntegrationAdmin(['crm.admin'])).toBe(false);
  });

  it('reports connected only when authorization and provider verification both succeed', () => {
    expect(canReportConnected({ authorized: true, providerVerified: true })).toBe(true);
    expect(canReportConnected({ authorized: true, providerVerified: false })).toBe(false);
    expect(canReportConnected({ authorized: false, providerVerified: true })).toBe(false);
  });
});
