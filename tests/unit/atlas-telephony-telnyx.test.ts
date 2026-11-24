import { describe, expect, it } from 'vitest';
import {
  isE164,
  probeTelnyxVoice,
  searchTelnyxAvailableNumbers,
  validateTelnyxConfig,
  type TelnyxVoiceConfig
} from '../../supabase/functions/_shared/telephony-telnyx';

function b64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

const config: TelnyxVoiceConfig = {
  apiKey: 'test-key',
  connectionId: 'connection-1',
  fromNumber: '+14075550100',
  webhookUrl: 'https://www.atlasenterprisesuite.com/api/telephony/telnyx',
  publicKey: b64(new Uint8Array(32))
};

describe('ATLAS Telnyx telephony adapter', () => {
  it('accepts E.164 destinations and rejects malformed values', () => {
    expect(isE164('+14075550100')).toBe(true);
    expect(isE164('4075550100')).toBe(false);
    expect(isE164('+0123')).toBe(false);
  });

  it('requires a complete HTTPS server-side configuration', () => {
    expect(validateTelnyxConfig(config)).toBeNull();
    expect(validateTelnyxConfig({ ...config, apiKey: '' })).toBe('api_key_missing');
    expect(validateTelnyxConfig({ ...config, webhookUrl: 'http://example.test/hook' }))
      .toBe('webhook_url_must_be_https');
    expect(validateTelnyxConfig({ ...config, publicKey: '' })).toBe('public_key_missing');
  });

  it('rejects malformed or wrong-length Telnyx signing keys locally', () => {
    expect(validateTelnyxConfig({ ...config, publicKey: 'not-base64!!' }))
      .toBe('public_key_invalid');
    expect(validateTelnyxConfig({ ...config, publicKey: b64(new Uint8Array(31)) }))
      .toBe('public_key_invalid');
  });

  it('marks the exact connection verified only after a successful provider probe', async () => {
    const seen: string[] = [];
    const fetchImpl = async (input: string | URL | Request) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'x-request-id': 'req-1' }
      });
    };

    await expect(probeTelnyxVoice(config, fetchImpl)).resolves.toEqual({
      state: 'verified',
      verified: true,
      statusCode: 200,
      requestId: 'req-1',
      blocker: null
    });
    expect(seen[0]).toContain('/v2/connections/connection-1/active_calls');
  });

  it.each([
    [401, 'provider_authentication_failed'],
    [403, 'provider_permission_denied'],
    [404, 'provider_connection_not_found'],
    [429, 'provider_rate_limited'],
    [500, 'provider_probe_failed']
  ])('fails closed for provider HTTP %s', async (status, blocker) => {
    const fetchImpl = async () => new Response('{}', { status });
    const result = await probeTelnyxVoice(config, fetchImpl);
    expect(result.verified).toBe(false);
    expect(result.state).toBe('degraded');
    expect(result.blocker).toBe(blocker);
  });

  it('fails closed when provider transport is unreachable', async () => {
    const result = await probeTelnyxVoice(config, async () => {
      throw new Error('offline');
    });
    expect(result).toMatchObject({
      state: 'degraded',
      verified: false,
      blocker: 'provider_unreachable'
    });
  });

  it('returns normalized discovery matches without exposing credentials', async () => {
    const seen: string[] = [];
    const result = await searchTelnyxAvailableNumbers(
      config,
      { countryCode: 'US', areaCode: '407', limit: 2 },
      async (input) => {
        seen.push(String(input));
        return new Response(JSON.stringify({
          data: [{
            phone_number: '+14075550101',
            reservable: true,
            quickship: true,
            best_effort: false,
            cost_information: { upfront_cost: '1.00' }
          }]
        }), { status: 200, headers: { 'x-request-id': 'search-1' } });
      }
    );

    expect(seen[0]).toContain('filter%5Bcountry_code%5D=US');
    expect(seen[0]).toContain('filter%5Bnational_destination_code%5D=407');
    expect(seen[0]).toContain('filter%5Blimit%5D=2');
    expect(result).toEqual({
      status: 'matches',
      candidates: [{
        phoneNumber: '+14075550101',
        reservable: true,
        quickship: true,
        bestEffort: false,
        costInformation: { upfront_cost: '1.00' }
      }],
      requestId: 'search-1'
    });
    expect(JSON.stringify(result)).not.toContain('test-key');
  });

  it('distinguishes a confirmed empty provider result from lookup errors', async () => {
    await expect(searchTelnyxAvailableNumbers(config, {}, async () =>
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    )).resolves.toMatchObject({ status: 'no_matches', candidates: [] });

    for (const [status, blocker] of [
      [401, 'provider_authentication_failed'],
      [403, 'provider_permission_denied'],
      [429, 'provider_rate_limited'],
      [500, 'provider_lookup_failed']
    ] as const) {
      const result = await searchTelnyxAvailableNumbers(config, {}, async () =>
        new Response('{}', { status })
      );
      expect(result).toMatchObject({ status: 'lookup_error', blocker, statusCode: status });
    }

    await expect(searchTelnyxAvailableNumbers(config, {}, async () =>
      new Response(JSON.stringify({ data: [{ reservable: true }] }), { status: 200 })
    )).resolves.toMatchObject({ status: 'lookup_error', blocker: 'provider_response_invalid' });

    await expect(searchTelnyxAvailableNumbers(config, {}, async () => {
      throw new Error('offline');
    })).resolves.toMatchObject({ status: 'lookup_error', blocker: 'provider_unreachable' });
  });
});
