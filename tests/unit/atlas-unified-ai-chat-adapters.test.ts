import { describe, expect, it, vi } from 'vitest';
import { createOpenAIResponsesAdapter } from '../../supabase/functions/atlas-copilot/openai-responses-adapter.mjs';
import { createAtlasLocalResponsesAdapter } from '../../supabase/functions/atlas-copilot/atlas-local-responses-adapter.mjs';
import { createAmazonBedrockResponsesAdapter } from '../../supabase/functions/atlas-copilot/amazon-bedrock-responses-adapter.mjs';
import { createGeminiAdapter } from '../../supabase/functions/atlas-copilot/gemini-adapter.mjs';
import { createCodexSovereignAdapter } from '../../supabase/functions/atlas-copilot/codex-sovereign-adapter.mjs';

const context = { organization_id: 'org-1', user_id: 'user-1' };
const route = { profile: 'balanced', capabilities: ['generation'] };

describe('ATLAS Unified AI provider adapters', () => {
  it('runs ATLAS Local through a verified self-hosted Responses-compatible runtime', async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer local-secret');
      expect(headers.get('CF-Access-Client-Id')).toBe('access-client');
      expect(headers.get('CF-Access-Client-Secret')).toBe('access-secret');
      if (url.endsWith('/health')) return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
      expect(url).toBe('https://local-ai.example/v1/responses');
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('local-model');
      expect(body.store).toBe(false);
      expect(String(body.instructions)).toContain('ATLAS LOCAL RUNTIME PROFILE');
      return new Response(JSON.stringify({
        id: 'local_resp_1',
        model: 'local-model',
        output: [{ content: [{ type: 'output_text', text: 'local-ok' }] }],
        usage: { input_tokens: 4, output_tokens: 2 },
      }), { status: 200 });
    });
    const adapter = createAtlasLocalResponsesAdapter({
      baseUrl: 'https://local-ai.example',
      token: 'local-secret',
      accessClientId: 'access-client',
      accessClientSecret: 'access-secret',
      models: { balanced: 'local-model' },
      fetchFn,
    });
    expect(adapter.descriptor()).toMatchObject({ id: 'atlas-local', configured: true, backend: 'self-hosted', access_protected: true });
    expect((await adapter.probe({ profile: 'balanced' })).verified).toBe(true);
    expect((await adapter.execute({ context, route, instructions: 'ATLAS', input: [{ role: 'user', content: 'hello' }] })).text).toBe('local-ok');
  });

  it('fails closed when ATLAS Local has no authenticated runtime configuration', async () => {
    const adapter = createAtlasLocalResponsesAdapter({
      baseUrl: 'https://local-ai.example',
      models: { balanced: 'local-model' },
    });
    expect(adapter.descriptor().configured).toBe(false);
    await expect(adapter.probe({ profile: 'balanced' })).resolves.toMatchObject({
      configured: false,
      verified: false,
      error: 'provider_not_configured',
    });
  });

  it('does not invent an OpenAI model when none is configured', () => {
    const adapter = createOpenAIResponsesAdapter({ apiKey: 'secret', models: {} });
    expect(adapter.descriptor().models).toEqual({ fast: null, balanced: null, deep: null });
  });

  it('refuses OpenAI execution when the selected profile has no configured model', async () => {
    const adapter = createOpenAIResponsesAdapter({ apiKey: 'secret', models: {} });
    await expect(adapter.execute({ context, route, instructions: 'ATLAS', input: [] }))
      .rejects.toMatchObject({ code: 'provider_not_configured' });
  });

  it('uses only the configured OpenAI model in Responses API calls', async () => {
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('configured-openai-model');
      expect(body.reasoning).toEqual({ effort: 'medium' });
      expect(body.prompt_cache_options).toEqual({ ttl: '30m' });
      expect(body.prompt_cache_key).toMatch(/^atlas_cache_[0-9a-f]{40}$/);
      expect(body.store).toBe(false);
      expect(body).not.toHaveProperty('temperature');
      expect(body).not.toHaveProperty('top_p');
      expect(body).not.toHaveProperty('top_logprobs');
      return new Response(JSON.stringify({
        id: 'resp_1',
        model: 'configured-openai-model',
        output: [{ content: [{ type: 'output_text', text: 'ok' }] }],
        usage: {},
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const adapter = createOpenAIResponsesAdapter({
      apiKey: 'secret',
      models: { balanced: 'configured-openai-model' },
      fetchFn,
    });
    const result = await adapter.execute({ context, route, instructions: 'ATLAS', input: [] });
    expect(result.text).toBe('ok');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('uses configuration_update for Astra profile changes while keeping request-level reasoning stable', async () => {
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.reasoning).toEqual({ effort: 'low' });
      const update = body.input.find((item: any) => item?.type === 'configuration_update');
      expect(update).toEqual({ type: 'configuration_update', reasoning: { effort: 'high' } });
      expect(body.input.at(-1)).toMatchObject({ role: 'user', content: 'hard problem' });
      return new Response(JSON.stringify({
        id: 'resp_astra',
        model: 'gpt-6-astra',
        output: [{ content: [{ type: 'output_text', text: 'astra-ok' }] }],
        usage: {},
      }), { status: 200 });
    });
    const adapter = createOpenAIResponsesAdapter({
      apiKey: 'secret',
      models: { deep: 'gpt-6-astra' },
      fetchFn,
    });
    const result = await adapter.execute({
      context,
      route: { profile: 'deep', capabilities: ['reasoning'] },
      instructions: 'ATLAS',
      input: [{ role: 'user', content: 'hard problem' }],
    });
    expect(result.text).toBe('astra-ok');
  });

  it('uses the recommended Bedrock Runtime Responses endpoint with Astra and no unsupported Astra-only controls', async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://bedrock-runtime.us-west-2.amazonaws.com/openai/v1/responses');
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('us.openai.gpt-6-astra');
      expect(body.reasoning).toEqual({ effort: 'medium' });
      expect(body.prompt_cache_options).toEqual({ ttl: '30m' });
      expect(body.store).toBe(false);
      expect(body).not.toHaveProperty('configuration_update');
      expect(body).not.toHaveProperty('background');
      return new Response(JSON.stringify({
        id: 'resp_bedrock',
        model: 'us.openai.gpt-6-astra',
        output: [{ content: [{ type: 'output_text', text: 'bedrock-ok' }] }],
        usage: {},
      }), { status: 200 });
    });
    const adapter = createAmazonBedrockResponsesAdapter({
      apiKey: 'bedrock-secret',
      region: 'us-west-2',
      endpoint: 'runtime',
      models: { balanced: 'us.openai.gpt-6-astra' },
      runtimeVerified: true,
      fetchFn,
    });
    expect((await adapter.probe({ profile: 'balanced' })).verified).toBe(true);
    expect((await adapter.execute({ route, instructions: 'ATLAS', input: [] })).text).toBe('bedrock-ok');
  });

  it('fails closed on Bedrock Runtime readiness until external verification evidence is configured', async () => {
    const adapter = createAmazonBedrockResponsesAdapter({
      apiKey: 'bedrock-secret',
      region: 'us-west-2',
      endpoint: 'runtime',
      models: { balanced: 'us.openai.gpt-6-astra' },
      runtimeVerified: false,
    });
    await expect(adapter.probe({ profile: 'balanced' })).resolves.toMatchObject({
      configured: true,
      verified: false,
      error: 'provider_verification_required',
    });
  });

  it('implements Gemini descriptor/probe/execute without a real provider call', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes(':generateContent')) {
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'gemini-ok' }] } }], usageMetadata: {} }), { status: 200 });
      }
      return new Response(JSON.stringify({ name: 'models/gemini-configured' }), { status: 200 });
    });
    const adapter = createGeminiAdapter({ apiKey: 'gemini-secret', models: { balanced: 'gemini-configured' }, fetchFn });
    expect((await adapter.probe({ profile: 'balanced' })).verified).toBe(true);
    expect((await adapter.execute({ context, route, instructions: 'ATLAS', input: [{ role: 'user', content: 'hello' }] })).text).toBe('gemini-ok');
  });

  it('implements Codex Sovereign only when its runtime health probe verifies', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.endsWith('/health')) return new Response(JSON.stringify({ ok: true, model: 'codex-sovereign' }), { status: 200 });
      return new Response(JSON.stringify({ text: 'codex-ok', model: 'codex-sovereign', usage: {} }), { status: 200 });
    });
    const adapter = createCodexSovereignAdapter({
      endpoint: 'https://codex.internal.example',
      token: 'codex-secret',
      model: 'codex-sovereign',
      fetchFn,
    });
    expect((await adapter.probe()).verified).toBe(true);
    expect((await adapter.execute({ context, route, instructions: 'ATLAS', input: [] })).text).toBe('codex-ok');
  });
});
