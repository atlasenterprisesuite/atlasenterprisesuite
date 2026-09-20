import { describe, expect, it, vi } from 'vitest';
import { createFreeLLMAPIAdapter } from '../../supabase/functions/atlas-copilot/freellmapi-adapter.mjs';

const context = { organization_id: 'org-1', user_id: 'user-1' };
const route = { profile: 'balanced', capabilities: ['generation'] };

describe('ATLAS FreeLLMAPI adapter', () => {
  it('probes and executes through the authenticated Responses-compatible surface', async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer unified-secret');
      if (url.endsWith('/v1/models')) return new Response(JSON.stringify({ data: [] }), { status: 200 });
      expect(url).toBe('https://freellm.internal/v1/responses');
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('auto');
      expect(body.store).toBe(false);
      expect(body.stream).toBe(false);
      return new Response(JSON.stringify({
        id: 'resp-free-1',
        model: 'resolved-model',
        output: [{ content: [{ type: 'output_text', text: 'free-pool-ok' }] }],
        usage: { input_tokens: 5, output_tokens: 3 },
      }), { status: 200, headers: { 'X-Routed-Via': 'groq/model-a' } });
    });
    const adapter = createFreeLLMAPIAdapter({
      enabled: true,
      baseUrl: 'https://freellm.internal',
      apiKey: 'unified-secret',
      fetchFn,
    });
    expect(adapter.descriptor()).toMatchObject({
      id: 'freellmapi',
      configured: true,
      backend: 'external-router',
      feature_support: { aggregate_router: true, production_supported: false, upstream_failover: true },
    });
    expect(await adapter.probe({ profile: 'balanced' })).toMatchObject({ verified: true, model: 'auto' });
    const result = await adapter.execute({ context, route, instructions: 'ATLAS', input: [{ role: 'user', content: 'hello' }] });
    expect(result.text).toBe('free-pool-ok');
    expect(result.usage.atlas_routed_via).toBe('groq/model-a');
  });

  it('is fail-closed unless explicitly enabled with an authenticated HTTPS runtime', async () => {
    expect(createFreeLLMAPIAdapter({
      enabled: false,
      baseUrl: 'https://freellm.internal',
      apiKey: 'secret',
    }).descriptor().configured).toBe(false);

    expect(createFreeLLMAPIAdapter({
      enabled: true,
      baseUrl: 'http://freellm.internal',
      apiKey: 'secret',
    }).descriptor().configured).toBe(false);

    expect(createFreeLLMAPIAdapter({
      enabled: true,
      baseUrl: 'https://user:pass@freellm.internal',
      apiKey: 'secret',
    }).descriptor().configured).toBe(false);
  });

  it('converts structurally malformed successful output into a retryable provider failure', async () => {
    const malformed = createFreeLLMAPIAdapter({
      enabled: true,
      baseUrl: 'https://freellm.internal',
      apiKey: 'secret',
      fetchFn: vi.fn(async () => new Response(JSON.stringify({
        id: 'resp-malformed',
        output: { content: { type: 'output_text', text: 'not-an-array' } },
      }), { status: 200 })),
    });
    await expect(malformed.execute({ route, instructions: 'ATLAS', input: [] })).rejects.toMatchObject({
      code: 'provider_unavailable',
      status: 502,
    });
  });

  it('normalizes exhausted-pool and transient upstream failures for outer ATLAS failover', async () => {
    const rateLimited = createFreeLLMAPIAdapter({
      enabled: true,
      baseUrl: 'https://freellm.internal',
      apiKey: 'secret',
      fetchFn: vi.fn(async () => new Response('{}', { status: 429 })),
    });
    await expect(rateLimited.execute({ route, instructions: 'ATLAS', input: [] })).rejects.toMatchObject({
      code: 'provider_rate_limited',
      status: 429,
    });

    const unavailable = createFreeLLMAPIAdapter({
      enabled: true,
      baseUrl: 'https://freellm.internal',
      apiKey: 'secret',
      fetchFn: vi.fn(async () => new Response('{}', { status: 503 })),
    });
    await expect(unavailable.execute({ route, instructions: 'ATLAS', input: [] })).rejects.toMatchObject({
      code: 'provider_unavailable',
      status: 502,
    });
  });
});
