import { describe, expect, it } from 'vitest';
import type { CrmObjectType } from '../../packages/core/src/crm';
import { HubSpotCrmAdapter } from '../../supabase/functions/_shared/hubspot-crm';
import { SalesforceCrmAdapter } from '../../supabase/functions/_shared/salesforce-crm';

describe('ATLAS CRM provider-neutral leads (read only)', () => {
  it('includes lead as a first-class CRM object type', () => {
    const type: CrmObjectType = 'lead';
    expect(type).toBe('lead');
  });

  it('maps a Salesforce Lead using a bounded, authorized SOQL read', async () => {
    const requests: string[] = [];
    const adapter = new SalesforceCrmAdapter();
    const page = await adapter.listObjects({
      accessToken: 'test-only',
      instanceUrl: 'https://example.my.salesforce.com',
      fetchImpl: async (url) => {
        requests.push(String(url));
        return new Response(JSON.stringify({
          done: true,
          records: [{
            Id: '00Q000000000001AAA',
            Name: 'Alex Example',
            Company: 'Example Co',
            Email: 'alex@example.test',
            Status: 'Open - Not Contacted',
            LeadSource: 'Web',
            IsConverted: false,
            LastModifiedDate: '2026-10-09T12:00:00Z'
          }]
        }), { status: 200 });
      }
    }, { objectType: 'lead', limit: 10 });

    expect(requests).toHaveLength(1);
    const url = new URL(requests[0]);
    expect(url.origin).toBe('https://example.my.salesforce.com');
    expect(url.searchParams.get('q')).toContain('FROM Lead');
    expect(url.searchParams.get('q')).toContain('LIMIT 10');
    expect(page.records).toEqual([expect.objectContaining({
      provider: 'salesforce',
      objectType: 'lead',
      displayName: 'Alex Example',
      fields: expect.objectContaining({
        company: 'Example Co', status: 'Open - Not Contacted',
        email: 'alex@example.test', converted: false
      })
    })]);
  });

  it('maps HubSpot leads without confusing them with contacts', async () => {
    const requests: string[] = [];
    const adapter = new HubSpotCrmAdapter();
    const page = await adapter.listObjects({
      accessToken: 'test-only',
      fetchImpl: async (url) => {
        requests.push(String(url));
        return new Response(JSON.stringify({
          results: [{
            id: '123',
            properties: {
              hs_lead_name: 'Prospect Co',
              hs_lead_status: 'NEW',
              hs_lead_type: 'NEW BUSINESS'
            },
            updatedAt: '2026-10-09T12:00:00Z'
          }]
        }), { status: 200 });
      }
    }, { objectType: 'lead', limit: 10 });

    expect(new URL(requests[0]).pathname).toBe('/crm/objects/2026-03/leads');
    expect(page.records).toEqual([expect.objectContaining({
      provider: 'hubspot',
      objectType: 'lead',
      displayName: 'Prospect Co',
      fields: expect.objectContaining({ name: 'Prospect Co', status: 'NEW' })
    })]);
  });
});
