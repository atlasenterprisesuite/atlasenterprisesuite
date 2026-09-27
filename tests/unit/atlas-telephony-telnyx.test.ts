import { describe, expect, it } from 'vitest';
import {
  isE164,
  probeTelnyxVoice,
  validateTelnyxConfig,
  type TelnyxVoiceConfig
} from '../../supabase/functions/_shared/telephony-telnyx';

const config: TelnyxVoiceConfig = {
  apiKey: 'test-key',
  connectionId: 'connection-1',
  fromNumber: '+14075550100',
  webhookUrl: 'https://www.atlasenterprisesuite.com/api/telephony/telnyx'
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
});
