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
});
