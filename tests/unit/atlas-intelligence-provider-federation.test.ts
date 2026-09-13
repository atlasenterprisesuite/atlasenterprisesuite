import { describe, expect, it } from 'vitest';
import {
  createIntelligenceGateway,
  createIntelligenceRouter
} from '../../supabase/functions/atlas-copilot/intelligence-gateway.mjs';

const context = {
  organization_id: 'org-test',
  user_id: 'user-test',
  permissions: ['intelligence.use'],
  roles: ['admin'],
  session_id: 'session-test',
  request_id: 'request-test'
};

function createStore() {
  return {
    async createConversation() { return { id: 'conversation-1' }; },
    async getConversation() { return { id: 'conversation-1' }; },
    async appendMessage() {},
    async startRequest() { return { id: 'request-row-1' }; },
    async listMessages() { return [{ role: 'user', content: { text: 'Review provider federation.' } }]; },
    async completeRequest() {},
    async failRequest() {}
  };
}

describe('ATLAS Intelligence provider federation', () => {
  it('executes with the adapter selected by the provider router', async () => {
    const calls: string[] = [];
    const gemini = {
      async execute() {
        calls.push('gemini');
        return {
          text: 'Gemini review complete.',
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          capabilities_used: ['generation', 'reasoning'],
          provenance: [],
          usage: {}
        };
      }
    };

    const router = createIntelligenceRouter({
      providers: [{
        id: 'gemini',
        configured: true,
        verified: true,
        capabilities: ['generation', 'reasoning'],
        profiles: ['fast', 'balanced', 'deep']
      }]
    });

    const gateway = createIntelligenceGateway({
      router,
      providers: { gemini },
      store: createStore(),
      clock: () => 1000
    });

    const result = await gateway.execute({
      context,
      request: {
        module: 'sovereign-ai',
        intent: 'deep',
        message: 'Review this implementation.',
        capabilities_requested: ['generation', 'reasoning']
      }
    });

    expect(calls).toEqual(['gemini']);
    expect(result.provider).toBe('gemini');
    expect(result.model).toBe('gemini-3.8-flash');
  });

  it('provides a Gemini adapter that stays unverified when no server-side key exists', async () => {
    const module = await import('../../supabase/functions/atlas-copilot/gemini-adapter.mjs');
    const adapter = module.createGeminiAdapter({
      apiKey: '',
      model: 'gemini-3.8-flash',
      fetchFn: async () => { throw new Error('fetch_must_not_run'); }
    });

    await expect(adapter.probe()).resolves.toEqual({
      configured: false,
      verified: false,
      provider: 'gemini',
      model: 'gemini-3.8-flash',
      error: 'provider_not_configured'
    });
  });

  it('verifies Gemini with models.get when the configured model is reachable', async () => {
    const module = await import('../../supabase/functions/atlas-copilot/gemini-adapter.mjs');
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const adapter = module.createGeminiAdapter({
      apiKey: 'server-secret',
      model: 'gemini-3.8-flash',
      fetchFn: async (url: URL | RequestInfo, options: RequestInit = {}) => {
        calls.push({ url: String(url), headers: options.headers as Record<string, string> });
        return new Response(JSON.stringify({ name: 'models/gemini-3.8-flash' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
    });

    await expect(adapter.probe()).resolves.toMatchObject({
      configured: true,
      verified: true,
      provider: 'gemini',
      model: 'gemini-3.8-flash',
      error: null
    });
    expect(calls[0].url).toMatch(/\/v1beta\/models\/gemini-3\.8-flash$/);
    expect(calls[0].headers['x-goog-api-key']).toBe('server-secret');
  });

  it('normalizes Gemini generateContent output into the ATLAS provider contract', async () => {
    const module = await import('../../supabase/functions/atlas-copilot/gemini-adapter.mjs');
    const calls: Array<{ url: string; options: RequestInit }> = [];
    const adapter = module.createGeminiAdapter({
      apiKey: 'server-secret',
      model: 'gemini-3.8-flash',
      fetchFn: async (url: URL | RequestInfo, options: RequestInit = {}) => {
        calls.push({ url: String(url), options });
        return new Response(JSON.stringify({
          modelVersion: 'gemini-3.8-flash',
          candidates: [{ content: { parts: [{ text: 'Independent review complete.' }] } }],
          usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5, totalTokenCount: 17 }
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
    });

    const result = await adapter.execute({
      route: { provider: 'gemini', profile: 'deep', capabilities: ['generation', 'reasoning'] },
      instructions: 'Preserve ATLAS governance.',
      input: [{ role: 'user', content: 'Review the change.' }],
      max_output_tokens: 512
    });

    expect(result.provider).toBe('gemini');
    expect(result.model).toBe('gemini-3.8-flash');
    expect(result.text).toBe('Independent review complete.');
    expect(result.capabilities_used).toEqual(['generation', 'reasoning']);
    expect(calls[0].url).toMatch(/gemini-3\.8-flash:generateContent$/);
    expect((calls[0].options.headers as Record<string, string>)['x-goog-api-key']).toBe('server-secret');
    const body = JSON.parse(String(calls[0].options.body));
    expect(body.systemInstruction.parts[0].text).toBe('Preserve ATLAS governance.');
    expect(body.contents[0].role).toBe('user');
    expect(body.generationConfig.maxOutputTokens).toBe(512);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'high', includeThoughts: false });
  });

  it('honors an explicit provider id and never silently falls back', () => {
    const router = createIntelligenceRouter({ providers: [
      {
        id: 'openai', configured: true, verified: true,
        capabilities: ['generation', 'reasoning'], profiles: ['fast', 'balanced', 'deep']
      },
      {
        id: 'gemini', configured: true, verified: false,
        capabilities: ['generation', 'reasoning'], profiles: ['fast', 'balanced', 'deep']
      }
    ] });

    expect(() => router.route({
      provider_id: 'gemini',
      intent: 'deep',
      capabilities_requested: ['generation', 'reasoning']
    })).toThrow(/capability_unavailable|provider_unavailable|provider_not_configured/);

    expect(router.route({
      provider_id: 'openai',
      intent: 'deep',
      capabilities_requested: ['generation', 'reasoning']
    }).provider).toBe('openai');
  });
});
