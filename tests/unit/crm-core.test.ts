import { describe, expect, it } from 'vitest';
import {
  CRM_PROVIDER_ERROR_CODES,
  canReportConnected,
  createIntegrationConnection,
  hasLegacyIntegrationAdmin,
  hasPermission
} from '../../packages/core/src/index';
import type {
  CrmAssociationPage,
  CrmConnectionView,
  CrmPage
} from '../../packages/core/src/index';

describe('ATLAS CRM core contracts', () => {
  it('supports HubSpot and Salesforce as CRM integration providers', () => {
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

    expect(
      createIntegrationConnection({
        scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
        provider: 'salesforce'
      })
    ).toEqual({
      scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
      provider: 'salesforce',
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

  it('exposes provider-neutral CRM pages without leaking provider-specific property names into the contract', () => {
    const page: CrmPage = {
      records: [
        {
          provider: 'hubspot',
          objectType: 'contact',
          providerId: '101',
          displayName: 'Ada Lovelace',
          fields: { email: 'ada@example.test', active: true },
          updatedAt: null
        },
        {
          provider: 'salesforce',
          objectType: 'company',
          providerId: '001ATLAS',
          displayName: 'ATLAS Enterprise Suite',
          fields: { industry: 'Technology', active: true },
          updatedAt: null
        }
      ],
      nextCursor: 'opaque-next'
    };

    expect(page.records[0].objectType).toBe('contact');
    expect(page.records[0].providerId).toBe('101');
    expect(page.records[1].provider).toBe('salesforce');
    expect(page.nextCursor).toBe('opaque-next');
  });

  it('models association pages and safe connection state without provider credentials', () => {
    const associations: CrmAssociationPage = {
      associations: [
        {
          provider: 'hubspot',
          fromObjectType: 'contact',
          fromProviderId: '101',
          toObjectType: 'company',
          toProviderId: '201',
          associationType: 'primary'
        }
      ],
      nextCursor: null
    };
    const connection: CrmConnectionView = {
      provider: 'salesforce',
      state: 'degraded',
      providerAccountId: '00D000000000001',
      providerAccountLabel: 'ATLAS Enterprise Suite',
      grantedScopes: ['api'],
      lastVerifiedAt: null,
      lastSuccessAt: null,
      safeErrorCode: 'forbidden_scope'
    };

    expect(associations.associations[0].toObjectType).toBe('company');
    expect(connection.provider).toBe('salesforce');
    expect(connection).not.toHaveProperty('accessToken');
    expect(connection).not.toHaveProperty('refreshToken');
  });

  it('publishes the required safe provider error vocabulary', () => {
    expect(CRM_PROVIDER_ERROR_CODES).toEqual(
      expect.arrayContaining([
        'expired_credential',
        'forbidden_scope',
        'rate_limited',
        'upstream_unavailable',
        'malformed_provider_response',
        'unknown_upstream_error'
      ])
    );
  });
});
