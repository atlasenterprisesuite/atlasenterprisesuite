import { describe, expect, it } from 'vitest';
import {
  HubSpotCrmAdapter,
  HubSpotCrmError,
  normalizeHubSpotRecord
} from '../../supabase/functions/_shared/hubspot-crm';
import type { HubSpotFetch } from '../../supabase/functions/_shared/hubspot-oauth';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) }
  });
}

const context = (fetchImpl: HubSpotFetch) => ({
  accessToken: 'fake-hubspot-access-token',
  fetchImpl
});

describe('HubSpot CRM read adapter', () => {
  it('retrieves provider account identity from the date-based account endpoint', async () => {
    const adapter = new HubSpotCrmAdapter();
    const fetchImpl: HubSpotFetch = async (input, init) => {
      expect(String(input)).toBe('https://api.hubapi.com/account-info/2026-03/details');
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        'Bearer fake-hubspot-access-token'
      );
      return jsonResponse({
        portalId: 247228429,
        accountType: 'STANDARD',
        timeZone: 'US/Eastern',
        companyCurrency: 'USD',
        dataHostingLocation: 'na1',
        uiDomain: 'app-na2.hubspot.com'
      });
    };

    await expect(adapter.getAccountIdentity(context(fetchImpl))).resolves.toEqual({
      id: '247228429',
      label: 'app-na2.hubspot.com',
      accountType: 'STANDARD',
      timeZone: 'US/Eastern',
      companyCurrency: 'USD',
      dataHostingLocation: 'na1'
    });
  });

  it('lists contacts with provider paging and normalized fields', async () => {
    const adapter = new HubSpotCrmAdapter();
    const fetchImpl: HubSpotFetch = async (input) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/crm/objects/2026-03/contacts');
      expect(url.searchParams.get('limit')).toBe('25');
      expect(url.searchParams.get('after')).toBe('cursor-1');
      expect(url.searchParams.get('properties')).toContain('firstname');
      return jsonResponse({
        results: [
          {
            id: '101',
            properties: {
              firstname: 'Ada',
              lastname: 'Lovelace',
              email: 'ada@example.test',
              phone: null,
              lifecyclestage: 'lead',
              provider_only_secret: 'must-not-pass-through'
            },
            updatedAt: '2026-09-15T00:00:00Z'
          }
        ],
        paging: { next: { after: 'cursor-2', link: 'ignored' } }
      });
    };

    const page = await adapter.listObjects(context(fetchImpl), {
      objectType: 'contact',
      limit: 25,
      cursor: 'cursor-1'
    });

    expect(page.nextCursor).toBe('cursor-2');
    expect(page.records).toEqual([
      {
        provider: 'hubspot',
        objectType: 'contact',
        providerId: '101',
        displayName: 'Ada Lovelace',
        fields: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.test',
          phone: null,
          lifecycleStage: 'lead'
        },
        updatedAt: '2026-09-15T00:00:00Z'
      }
    ]);
    expect(JSON.stringify(page)).not.toContain('provider_only_secret');
  });

  it.each([
    [
      'company' as const,
      { name: 'Atlas Co', domain: 'atlas.test', industry: 'Software', phone: '555' },
      'Atlas Co',
      { name: 'Atlas Co', domain: 'atlas.test', industry: 'Software', phone: '555' }
    ],
    [
      'deal' as const,
      {
        dealname: 'Enterprise rollout',
        amount: '1000.00',
        hs_currency: 'USD',
        pipeline: 'default',
        dealstage: 'qualifiedtobuy',
        closedate: '2026-10-01'
      },
      'Enterprise rollout',
      {
        name: 'Enterprise rollout',
        amount: '1000.00',
        currency: 'USD',
        pipeline: 'default',
        stage: 'qualifiedtobuy',
        closeDate: '2026-10-01'
      }
    ],
    [
      'ticket' as const,
      {
        subject: 'Need help',
        hs_pipeline: '0',
        hs_pipeline_stage: '1',
        hs_ticket_priority: 'HIGH'
      },
      'Need help',
      { subject: 'Need help', pipeline: '0', stage: '1', priority: 'HIGH' }
    ],
    [
      'task' as const,
      {
        hs_task_subject: 'Follow up',
        hs_task_body: 'Call customer',
        hs_timestamp: '2026-09-15T10:00:00Z',
        hubspot_owner_id: '12'
      },
      'Follow up',
      {
        subject: 'Follow up',
        preview: 'Call customer',
        occurredAt: '2026-09-15T10:00:00Z',
        ownerId: '12'
      }
    ]
  ])('normalizes %s records without HubSpot property names in fields', (objectType, properties, name, fields) => {
    const record = normalizeHubSpotRecord(objectType, {
      id: '123',
      properties,
      updatedAt: null
    });
    expect(record.displayName).toBe(name);
    expect(record.fields).toEqual(fields);
  });

  it('omits optional fields that the provider did not return instead of inventing values', () => {
    const record = normalizeHubSpotRecord('company', {
      id: '201',
      properties: { name: 'Only Name' },
      updatedAt: null
    });
    expect(record.fields).toEqual({ name: 'Only Name' });
    expect(record.fields).not.toHaveProperty('industry');
  });

  it('dispatches search to the documented provider search endpoint rather than filtering locally', async () => {
    const adapter = new HubSpotCrmAdapter();
    const fetchImpl: HubSpotFetch = async (input, init) => {
      expect(String(input)).toBe('https://api.hubapi.com/crm/objects/2026-03/deals/search');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.query).toBe('enterprise');
      expect(body.after).toBe('next-1');
      expect(body.properties).toContain('dealname');
      return jsonResponse({ results: [], total: 0 });
    };

    await expect(
      adapter.searchObjects(context(fetchImpl), {
        objectType: 'deal',
        query: 'enterprise',
        cursor: 'next-1',
        limit: 40
      })
    ).resolves.toEqual({ records: [], nextCursor: null });
  });

  it('gets one object by provider ID using a read-only GET', async () => {
    const adapter = new HubSpotCrmAdapter();
    const fetchImpl: HubSpotFetch = async (input, init) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/crm/objects/2026-03/companies/201');
      expect(init?.method).toBeUndefined();
      return jsonResponse({
        id: '201',
        properties: { name: 'Atlas Co' },
        updatedAt: null
      });
    };

    await expect(
      adapter.getObject(context(fetchImpl), { objectType: 'company', providerId: '201' })
    ).resolves.toMatchObject({ providerId: '201', displayName: 'Atlas Co' });
  });

  it('normalizes association labels and preserves opaque paging', async () => {
    const adapter = new HubSpotCrmAdapter();
    const fetchImpl: HubSpotFetch = async (input) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/crm/objects/2026-03/contacts/101/associations/companies');
      expect(url.searchParams.get('after')).toBe('assoc-1');
      return jsonResponse({
        results: [
          {
            toObjectId: 201,
            associationTypes: [
              { category: 'HUBSPOT_DEFINED', typeId: 1, label: 'Primary' },
              { category: 'HUBSPOT_DEFINED', typeId: 279, label: null }
            ]
          }
        ],
        paging: { next: { after: 'assoc-2' } }
      });
    };

    const page = await adapter.listAssociations(context(fetchImpl), {
      objectType: 'contact',
      providerId: '101',
      targetObjectType: 'company',
      cursor: 'assoc-1'
    });

    expect(page.nextCursor).toBe('assoc-2');
    expect(page.associations).toEqual([
      {
        provider: 'hubspot',
        fromObjectType: 'contact',
        fromProviderId: '101',
        toObjectType: 'company',
        toProviderId: '201',
        associationType: 'Primary'
      },
      {
        provider: 'hubspot',
        fromObjectType: 'contact',
        fromProviderId: '101',
        toObjectType: 'company',
        toProviderId: '201',
        associationType: 'HUBSPOT_DEFINED:279'
      }
    ]);
  });

  it.each([
    [401, 'expired_credential'],
    [403, 'forbidden_scope'],
    [404, 'not_found'],
    [429, 'rate_limited'],
    [503, 'upstream_unavailable']
  ] as const)('maps HTTP %s to the safe provider error %s', async (status, code) => {
    const leaked = 'fake-access-token-must-not-leak';
    const fetchImpl: HubSpotFetch = async () =>
      jsonResponse(
        { message: `provider body echoed ${leaked}` },
        { status, headers: status === 429 ? { 'retry-after': '8' } : {} }
      );
    const adapter = new HubSpotCrmAdapter();

    try {
      await adapter.listObjects({ accessToken: leaked, fetchImpl }, { objectType: 'contact' });
      throw new Error('Expected provider request to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(HubSpotCrmError);
      expect((error as HubSpotCrmError).code).toBe(code);
      expect(String(error)).not.toContain(leaked);
      if (status === 429) expect((error as HubSpotCrmError).retryAfterSeconds).toBe(8);
    }
  });

  it('rejects malformed provider records', async () => {
    const adapter = new HubSpotCrmAdapter();
    const fetchImpl: HubSpotFetch = async () => jsonResponse({ results: [{ properties: {} }] });
    await expect(
      adapter.listObjects(context(fetchImpl), { objectType: 'contact' })
    ).rejects.toMatchObject({ code: 'malformed_provider_response' });
  });

  it('reports readiness only after account identity and a live CRM read both succeed', async () => {
    const adapter = new HubSpotCrmAdapter();
    const fetchImpl: HubSpotFetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/account-info/2026-03/details')) {
        return jsonResponse({
          portalId: 247228429,
          accountType: 'STANDARD',
          timeZone: 'US/Eastern',
          companyCurrency: 'USD',
          dataHostingLocation: 'na1',
          uiDomain: 'app-na2.hubspot.com'
        });
      }
      return jsonResponse({ results: [] });
    };

    const readiness = await adapter.readiness(context(fetchImpl));
    expect(readiness.ready).toBe(true);
    expect(readiness.account?.id).toBe('247228429');
    expect(readiness.error).toBeNull();
  });
});
