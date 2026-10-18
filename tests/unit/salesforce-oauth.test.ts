import { describe, expect, it } from 'vitest';
import {
  buildSalesforceAuthorizationUrl,
  exchangeSalesforceCode,
  introspectSalesforceToken,
  normalizeSalesforceInstanceUrl,
  normalizeSalesforceLoginBaseUrl,
  revokeSalesforceToken
} from '../../supabase/functions/_shared/salesforce-oauth';

describe('Salesforce OAuth adapter', () => {
  it('builds a production authorization URL with state and least P0 scopes', () => {
    const value = buildSalesforceAuthorizationUrl({
      clientId: 'client-id',
      redirectUri: 'https://atlas.example/functions/v1/atlas-crm-salesforce',
      state: 'state-value',
      scopes: ['api', 'refresh_token']
    });
    const url = new URL(value);
    expect(url.origin).toBe('https://login.salesforce.com');
    expect(url.pathname).toBe('/services/oauth2/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(url.searchParams.get('scope')).toBe('api refresh_token');
  });

  it('allows only Salesforce login and instance hosts', () => {
    expect(normalizeSalesforceLoginBaseUrl('https://test.salesforce.com'))
      .toBe('https://test.salesforce.com');
    expect(normalizeSalesforceLoginBaseUrl('https://atlas.my.salesforce.com'))
      .toBe('https://atlas.my.salesforce.com');
    expect(normalizeSalesforceInstanceUrl('https://na123.salesforce.com'))
      .toBe('https://na123.salesforce.com');
    expect(() => normalizeSalesforceLoginBaseUrl('https://evil.example')).toThrow();
    expect(() => normalizeSalesforceInstanceUrl('https://evil.example')).toThrow();
    expect(() => normalizeSalesforceInstanceUrl('http://na123.salesforce.com')).toThrow();
  });

  it('exchanges and introspects tokens without surfacing provider secrets', async () => {
    const seen: Array<{ url: string; body: string }> = [];
    const fetchImpl: typeof fetch = async (resource, init) => {
      const url = String(resource);
      seen.push({ url, body: String(init?.body ?? '') });
      if (url.endsWith('/services/oauth2/token')) {
        return new Response(JSON.stringify({
          access_token: 'access-value',
          refresh_token: 'refresh-value',
          token_type: 'Bearer',
          scope: 'api refresh_token',
          instance_url: 'https://na123.salesforce.com',
          id: 'https://login.salesforce.com/id/00D000000000001/005000000000001',
          issued_at: '1791331200000'
        }), { status: 200 });
      }
      if (url.endsWith('/services/oauth2/introspect')) {
        return new Response(JSON.stringify({
          active: true,
          client_id: 'client-id',
          username: 'atlas@example.test',
          sub: '005000000000001',
          scope: 'api refresh_token',
          exp: 1893456000
        }), { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const token = await exchangeSalesforceCode({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://atlas.example/functions/v1/atlas-crm-salesforce',
      code: 'authorization-code',
      fetchImpl
    });
    expect(token).toMatchObject({
      accessToken: 'access-value',
      refreshToken: 'refresh-value',
      instanceUrl: 'https://na123.salesforce.com',
      scopes: ['api', 'refresh_token']
    });

    const introspection = await introspectSalesforceToken({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      token: token.accessToken,
      fetchImpl
    });
    expect(introspection.active).toBe(true);
    expect(introspection.scopes).toEqual(['api', 'refresh_token']);
    expect(seen[0].body).toContain('client_secret=client-secret');
    expect(seen[1].body).toContain('token=access-value');
  });

  it('revokes through the provider endpoint', async () => {
    let requestBody = '';
    await revokeSalesforceToken({
      token: 'refresh-value',
      fetchImpl: async (_resource, init) => {
        requestBody = String(init?.body ?? '');
        return new Response('{}', { status: 200 });
      }
    });
    expect(requestBody).toContain('token=refresh-value');
  });
});
