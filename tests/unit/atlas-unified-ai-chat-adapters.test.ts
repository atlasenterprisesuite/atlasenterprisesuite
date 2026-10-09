import { describe, expect, it, vi } from 'vitest';
import { createOpenAIResponsesAdapter } from '../../supabase/functions/atlas-copilot/openai-responses-adapter.mjs';
import { createAtlasLocalResponsesAdapter } from '../../supabase/functions/atlas-copilot/atlas-local-responses-adapter.mjs';
import { createAmazonBedrockResponsesAdapter } from '../../supabase/functions/atlas-copilot/amazon-bedrock-responses-adapter.mjs';
import { createGeminiAdapter } from '../../supabase/functions/atlas-copilot/gemini-adapter.mjs';
import { createCodexSovereignAdapter } from '../../supabase/functions/atlas-copilot/codex-sovereign-adapter.mjs';
import { createAnthropicAdapter } from '../../supabase/functions/atlas-copilot/anthropic-adapter.mjs';
import { createOpenAICompatibleChatAdapter } from '../../supabase/functions/atlas-copilot/openai-compatible-chat-adapter.mjs';

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
      expect(body.max_output_tokens).toBe(384);
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

  it('retries transient ATLAS Local health failures before declaring the provider unavailable', async () => {
    let attempt = 0;
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toBe('https://local-ai.example/health');
      attempt += 1;
      if (attempt < 3) return new Response(JSON.stringify({ error: 'warming' }), { status: 503 });
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
    });
    const adapter = createAtlasLocalResponsesAdapter({
      baseUrl: 'https://local-ai.example',
      token: 'local-secret',
      models: { balanced: 'local-model' },
      fetchFn,
      probeAttempts: 4,
      probeRetryDelayMs: 0,
    });
    await expect(adapter.probe({ profile: 'balanced' })).resolves.toMatchObject({
      configured: true,
      verified: true,
      error: null,
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('bounds ATLAS Local conversation history while preserving the newest turn', async () => {
    let captured: any = null;
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      captured = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        id: 'local_resp_compact',
        model: 'local-model',
        output: [{ content: [{ type: 'output_text', text: 'bounded-ok' }] }],
        usage: {},
      }), { status: 200 });
    });
    const adapter = createAtlasLocalResponsesAdapter({
      baseUrl: 'https://local-ai.example',
      token: 'local-secret',
      models: { balanced: 'local-model' },
      fetchFn,
    });
    const oldTurn = { role: 'user', content: 'old '.repeat(4000) };
    const middleTurn = { role: 'assistant', content: 'middle '.repeat(2000) };
    const newestTurn = { role: 'user', content: 'latest request' };
    const result = await adapter.execute({ context, route, instructions: 'ATLAS', input: [oldTurn, middleTurn, newestTurn], max_output_tokens: 3000 });
    expect(result.text).toBe('bounded-ok');
    expect(captured.max_output_tokens).toBe(384);
    expect(captured.input.at(-1)).toEqual(newestTurn);
    expect(captured.input).not.toContainEqual(oldTurn);
  });

  it('compacts oversized sovereign instructions for the local runtime while preserving cognitive context', async () => {
    let captured: any = null;
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      captured = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        id: 'local_resp_compact_instructions',
        model: 'local-model',
        output: [{ content: [{ type: 'output_text', text: 'compact-ok' }] }],
        usage: {},
      }), { status: 200 });
    });
    const adapter = createAtlasLocalResponsesAdapter({
      baseUrl: 'https://local-ai.example',
      token: 'local-secret',
      models: { balanced: 'local-model' },
      fetchFn,
    });
    const oversized = `${'MASTER '.repeat(4000)}\nCURRENT COGNITIVE CONTEXT\nModule: learning\nRouting mode: auto\nReasoning profile: balanced`;
    await adapter.execute({ context, route, instructions: oversized, input: [{ role: 'user', content: 'hello' }] });
    expect(String(captured.instructions).length).toBeLessThan(3000);
    expect(captured.instructions).toContain('You are ATLAS');
    expect(captured.instructions).toContain('CURRENT COGNITIVE CONTEXT');
    expect(captured.instructions).toContain('Module: learning');
    expect(captured.max_output_tokens).toBe(384);
  });

  it('marks ATLAS Local assistant history as Responses output messages for llama.cpp continuity', async () => {
    let captured: any = null;
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      captured = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        id: 'local_resp_continuity',
        model: 'local-model',
        output: [{ content: [{ type: 'output_text', text: 'continued-ok' }] }],
        usage: {},
      }), { status: 200 });
    });
    const adapter = createAtlasLocalResponsesAdapter({
      baseUrl: 'https://local-ai.example',
      token: 'local-secret',
      models: { balanced: 'local-model' },
      fetchFn,
    });
    const assistantTurn = { role: 'assistant', content: 'previous answer' };
    const userTurn = { role: 'user', content: 'continue' };
    const result = await adapter.execute({ context, route, instructions: 'ATLAS', input: [assistantTurn, userTurn] });
    expect(result.text).toBe('continued-ok');
    expect(captured.input[0]).toEqual({ ...assistantTurn, type: 'message' });
    expect(captured.input[1]).toEqual(userTurn);
  });

  it('retries one transient ATLAS Local inference failure before failing closed', async () => {
    let attempt = 0;
    const fetchFn = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) return new Response(JSON.stringify({ error: 'warming' }), { status: 503 });
      return new Response(JSON.stringify({
        id: 'local_resp_retry',
        model: 'local-model',
        output: [{ content: [{ type: 'output_text', text: 'retry-ok' }] }],
        usage: {},
      }), { status: 200 });
    });
    const adapter = createAtlasLocalResponsesAdapter({
      baseUrl: 'https://local-ai.example',
      token: 'local-secret',
      models: { balanced: 'local-model' },
      fetchFn,
      retryDelayMs: 0,
    });
    const result = await adapter.execute({ context, route, instructions: 'ATLAS', input: [{ role: 'user', content: 'continue' }] });
    expect(result.text).toBe('retry-ok');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('uses one bounded ATLAS Local attempt for detached background execution', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ error: 'warming' }), { status: 503 }));
    const adapter = createAtlasLocalResponsesAdapter({
      baseUrl: 'https://local-ai.example',
      token: 'local-secret',
      models: { balanced: 'local-model' },
      fetchFn,
      executionAttempts: 4,
      retryDelayMs: 0,
    });
    await expect(adapter.execute({
      context,
      route,
      instructions: 'ATLAS',
      input: [{ role: 'user', content: 'continue' }],
      background: true,
    })).rejects.toMatchObject({ code: 'provider_unavailable' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
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

  it('starts and retrieves an OpenAI background response without blocking the request', async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(url).toBe('https://api.openai.com/v1/responses');
        expect(body.background).toBe(true);
        expect(body.store).toBe(false);
        return new Response(JSON.stringify({
          id: 'resp_background_1',
          status: 'queued',
          model: 'configured-openai-model',
          usage: {}
        }), { status: 200 });
      }
      expect(url).toBe('https://api.openai.com/v1/responses/resp_background_1');
      return new Response(JSON.stringify({
        id: 'resp_background_1',
        status: 'completed',
        model: 'configured-openai-model',
        output: [{ content: [{ type: 'output_text', text: 'background-ok' }] }],
        usage: { output_tokens: 3 }
      }), { status: 200 });
    });
    const adapter = createOpenAIResponsesAdapter({
      apiKey: 'secret',
      models: { balanced: 'configured-openai-model' },
      fetchFn,
    });
    expect(adapter.descriptor().feature_support?.background).toBe(true);
    const started = await adapter.startBackground({
      context,
      route,
      instructions: 'ATLAS',
      input: [{ role: 'user', content: 'long task' }],
    });
    expect(started).toMatchObject({ response_id: 'resp_background_1', status: 'queued', text: null });
    const completed = await adapter.retrieveBackground({ response_id: started.response_id });
    expect(completed).toMatchObject({ status: 'completed', text: 'background-ok' });
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

  it('implements Gemini 3.8 reasoning profiles without a real provider call', async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes(':generateContent')) {
        const body = JSON.parse(String(init?.body));
        expect(body.generationConfig).toMatchObject({
          maxOutputTokens: 3000,
          thinkingConfig: { thinkingLevel: 'medium' },
        });
        expect(body.systemInstruction).toEqual({ parts: [{ text: 'ATLAS' }] });
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'gemini-ok' }] } }], usageMetadata: {} }), { status: 200 });
      }
      expect(url).toContain('/v1beta/models/gemini-3.8-flash');
      return new Response(JSON.stringify({ name: 'models/gemini-3.8-flash' }), { status: 200 });
    });
    const adapter = createGeminiAdapter({ apiKey: 'gemini-secret', models: { balanced: 'gemini-3.8-flash' }, fetchFn });
    expect(adapter.descriptor()).toMatchObject({
      id: 'gemini',
      models: { balanced: 'gemini-3.8-flash' },
      feature_support: { thinking_levels: ['low', 'medium', 'high'] },
    });
    expect((await adapter.probe({ profile: 'balanced' })).verified).toBe(true);
    expect((await adapter.execute({ context, route, instructions: 'ATLAS', input: [{ role: 'user', content: 'hello' }] })).text).toBe('gemini-ok');
  });

  it('maps ATLAS fast and deep profiles to Gemini thinking levels', async () => {
    const observed: string[] = [];
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      observed.push(body.generationConfig?.thinkingConfig?.thinkingLevel);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] }], }], usageMetadata: {} }), { status: 200 });
    });
    const adapter = createGeminiAdapter({
      apiKey: 'gemini-secret',
      models: { fast: 'gemini-3.8-flash', deep: 'gemini-3.8-flash' },
      fetchFn,
    });
    await adapter.execute({ context, route: { ...route, profile: 'fast' }, instructions: 'ATLAS', input: [{ role: 'user', content: 'fast' }] });
    await adapter.execute({ context, route: { ...route, profile: 'deep' }, instructions: 'ATLAS', input: [{ role: 'user', content: 'deep' }] });
    expect(observed).toEqual(['low', 'high']);
  });


  it('implements Anthropic Messages with model readiness verification', async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('x-api-key')).toBe('anthropic-secret');
      expect(headers.get('anthropic-version')).toBe('2023-06-01');
      if (init?.method !== 'POST') {
        expect(url).toBe('https://api.anthropic.com/v1/models/claude-sonnet-5-5');
        return new Response(JSON.stringify({ type: 'model', id: 'claude-sonnet-5-5' }), { status: 200 });
      }
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      const body = JSON.parse(String(init.body));
      expect(body.model).toBe('claude-sonnet-5-5');
      expect(body.output_config).toEqual({ effort: 'medium' });
      expect(body.system).toBe('ATLAS');
      return new Response(JSON.stringify({
        id: 'msg_1',
        model: 'claude-sonnet-5-5',
        content: [{ type: 'text', text: 'claude-ok' }],
        usage: { input_tokens: 4, output_tokens: 2 }
      }), { status: 200 });
    });
    const adapter = createAnthropicAdapter({
      apiKey: 'anthropic-secret',
      models: { balanced: 'claude-sonnet-5-5' },
      fetchFn,
    });
    expect((await adapter.probe({ profile: 'balanced' })).verified).toBe(true);
    expect((await adapter.execute({ context, route, instructions: 'ATLAS', input: [{ role: 'user', content: 'hello' }] })).text).toBe('claude-ok');
  });

  it('supports Grok, DeepSeek, Mistral and Qwen through one governed OpenAI-compatible contract', async () => {
    const providers = [
      { id: 'grok', baseUrl: 'https://api.x.ai/v1', model: 'grok-4.7' },
      { id: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-pro' },
      { id: 'mistral', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-large-latest' },
      { id: 'qwen', baseUrl: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
    ];
    for (const spec of providers) {
      const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method !== 'POST') {
          expect(url).toBe(spec.baseUrl + '/models');
          return new Response(JSON.stringify({ data: [{ id: spec.model }] }), { status: 200 });
        }
        expect(url).toBe(spec.baseUrl + '/chat/completions');
        const body = JSON.parse(String(init.body));
        expect(body.model).toBe(spec.model);
        expect(body.messages[0]).toEqual({ role: 'system', content: 'ATLAS' });
        return new Response(JSON.stringify({
          id: spec.id + '-1',
          model: spec.model,
          choices: [{ message: { content: spec.id + '-ok' } }],
          usage: {}
        }), { status: 200 });
      });
      const adapter = createOpenAICompatibleChatAdapter({
        id: spec.id,
        apiKey: 'provider-secret',
        baseUrl: spec.baseUrl,
        models: { balanced: spec.model },
        fetchFn,
      });
      expect((await adapter.probe({ profile: 'balanced' })).verified).toBe(true);
      expect((await adapter.execute({ route, instructions: 'ATLAS', input: [{ role: 'user', content: 'hello' }] })).text).toBe(spec.id + '-ok');
    }
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
