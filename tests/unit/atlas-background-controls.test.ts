import { describe, expect, it, vi } from 'vitest';
import { createOpenAIResponsesAdapter } from '../../supabase/functions/atlas-copilot/openai-responses-adapter.mjs';
import { verifyOpenAIWebhook } from '../../supabase/functions/atlas-copilot/openai-webhook.mjs';

async function signature(secretBytes: Uint8Array, id: string, timestamp: string, body: string) {
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return btoa(String.fromCharCode(...new Uint8Array(signed)));
}

describe('ATLAS background provider controls', () => {
  it('verifies Standard Webhooks signatures and rejects tampering', async () => {
    const secretBytes = new TextEncoder().encode('atlas-webhook-test-secret');
    const secret = 'whsec_' + btoa(String.fromCharCode(...secretBytes));
    const body = JSON.stringify({ object: 'event', type: 'response.completed', data: { id: 'resp_1' } });
    const id = 'wh_test_1';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sig = await signature(secretBytes, id, timestamp, body);
    const headers = new Headers({
      'webhook-id': id,
      'webhook-timestamp': timestamp,
      'webhook-signature': 'v1,' + sig
    });
    await expect(verifyOpenAIWebhook({ body, headers, secret })).resolves.toMatchObject({ webhookId: id });
    await expect(verifyOpenAIWebhook({ body: body + 'x', headers, secret })).rejects.toMatchObject({ code: 'invalid_webhook_signature' });
  });

  it('uses the provider-native Responses cancellation endpoint', async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://api.openai.com/v1/responses/resp_background_1/cancel');
      expect(init?.method).toBe('POST');
      return new Response(JSON.stringify({ id: 'resp_background_1', status: 'cancelled', model: 'configured-openai-model' }), { status: 200 });
    });
    const adapter = createOpenAIResponsesAdapter({
      apiKey: 'secret',
      models: { fast: 'configured-openai-model', balanced: 'configured-openai-model', deep: 'configured-openai-model' },
      fetchFn
    });
    await expect(adapter.cancelBackground({ response_id: 'resp_background_1' }))
      .resolves.toMatchObject({ response_id: 'resp_background_1', status: 'cancelled' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
