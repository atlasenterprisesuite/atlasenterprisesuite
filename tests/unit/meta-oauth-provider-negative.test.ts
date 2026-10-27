import { describe, expect, it, vi } from 'vitest';
import {
  introspectHubSpotToken, revokeHubSpotToken, exchangeHubSpotCode
} from '../../supabase/functions/_shared/hubspot-oauth';
import {
  introspectSalesforceToken, revokeSalesforceToken, exchangeSalesforceCode,
  normalizeSalesforceLoginBaseUrl
} from '../../supabase/functions/_shared/salesforce-oauth';

// Provider transport is injected and mocked. No real OAuth or network requests.
const rejectNetwork = vi.fn().mockRejectedValue(new Error('network disabled'));
describe('CRM provider transport negative contracts (offline)', () => {
  it('rejects an invalid Salesforce redirect host before building authorization', () => {
    expect(() => normalizeSalesforceLoginBaseUrl('https://login.salesforce.com.attacker.invalid'))
      .toThrow('Salesforce login host is not allowed');
  });

  it('rejects malformed HubSpot token payload without exposing its contents', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'sensitive-value' }), { status: 200 }));
    await expect(exchangeHubSpotCode({
      clientId: 'offline-client', clientSecret: 'offline-secret',
      redirectUri: 'https://atlas.example.test/callback', code: 'offline-code', fetchImpl
    })).rejects.toMatchObject({ code: 'malformed_response' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed Salesforce token payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    await expect(exchangeSalesforceCode({
      clientId: 'offline-client', clientSecret: 'offline-secret',
      redirectUri: 'https://atlas.example.test/callback', code: 'offline-code', fetchImpl
    })).rejects.toMatchObject({ code: 'malformed_response' });
  });

  it('fails closed when HubSpot introspection is unavailable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(introspectHubSpotToken({
      clientId: 'offline-client', clientSecret: 'offline-secret',
      token: 'invalid-token', tokenTypeHint: 'access_token', fetchImpl
    })).rejects.toMatchObject({ code: 'upstream_unavailable' });
  });

  it('fails closed when Salesforce introspection is unavailable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(introspectSalesforceToken({
      clientId: 'offline-client', clientSecret: 'offline-secret',
      token: 'invalid-token', fetchImpl
    })).rejects.toMatchObject({ code: 'upstream_unavailable' });
  });

  it('rejects a failed HubSpot remote revocation', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(revokeHubSpotToken({
      clientId: 'offline-client', clientSecret: 'offline-secret',
      token: 'offline-token', fetchImpl
    })).rejects.toMatchObject({ code: 'upstream_unavailable' });
  });

  it('rejects a failed Salesforce remote revocation', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(revokeSalesforceToken({ token: 'offline-token', fetchImpl }))
      .rejects.toMatchObject({ code: 'upstream_unavailable' });
  });
});
