import { describe, expect, it, vi } from 'vitest';
import { createOpenAIResponsesAdapter } from '../../supabase/functions/atlas-copilot/openai-responses-adapter.mjs';
import { createGeminiAdapter } from '../../supabase/functions/atlas-copilot/gemini-adapter.mjs';
import { createCodexSovereignAdapter } from '../../supabase/functions/atlas-copilot/codex-sovereign-adapter.mjs';

const context = { organization_id: 'org-1', user_id: 'user-1' };
const route = { profile: 'balanced', capabilities: ['generation'] };

describe('ATLAS Unified AI provider adapters', () => {
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
