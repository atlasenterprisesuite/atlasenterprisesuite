import { describe, expect, it } from 'vitest';
import { HubSpotCrmAdapter } from '../../supabase/functions/_shared/hubspot-crm';
import type { HubSpotFetch } from '../../supabase/functions/_shared/hubspot-oauth';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) }
  });
}

describe('HubSpot CRM governed writes', () => {
  it('creates a contact using only whitelisted provider properties', async () => {
    const adapter = new HubSpotCrmAdapter();
    const fetchImpl: HubSpotFetch = async (input, init) => {
      expect(String(input)).toBe('https://api.hubapi.com/crm/objects/2026-03/contacts');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body)) as { properties: Record<string, unknown> };
      expect(body.properties).toEqual({
        firstname: 'Ada',
        lastname: 'Lovelace',
        email: 'ada@example.test',
        lifecyclestage: 'lead'
      });
      expect(body.properties).not.toHaveProperty('providerInternal');
      return jsonResponse({
        id: '901',
        properties: {
          firstname: 'Ada',
          lastname: 'Lovelace',
          email: 'ada@example.test',
          lifecyclestage: 'lead'
        },
        updatedAt: '2026-09-19T04:30:00Z'
      });
    };

    const record = await adapter.createObject(
      { accessToken: 'fake-hubspot-access-token', fetchImpl },
      {
        objectType: 'contact',
        fields: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.test',
          lifecycleStage: 'lead',
          providerInternal: 'must-not-pass-through'
        }
      }
    );

    expect(record.providerId).toBe('901');
    expect(record.displayName).toBe('Ada Lovelace');
  });

  it('rejects activity-object writes outside the governed write contract', async () => {
    const adapter = new HubSpotCrmAdapter();
    await expect(adapter.createObject(
      { accessToken: 'fake', fetchImpl: async () => jsonResponse({}) },
      { objectType: 'email', fields: { subject: 'No' } }
    )).rejects.toThrow('not writable');
  });
});
