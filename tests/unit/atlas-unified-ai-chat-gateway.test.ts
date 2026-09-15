import { describe, expect, it } from 'vitest';
import { createIntelligenceGateway, createIntelligenceRouter } from '../../supabase/functions/atlas-copilot/intelligence-gateway.mjs';
import { createProviderRegistry } from '../../supabase/functions/atlas-copilot/provider-registry.mjs';
import { createCouncilOrchestrator } from '../../supabase/functions/atlas-copilot/council-orchestrator.mjs';
import { createToolGateway } from '../../supabase/functions/atlas-copilot/tool-gateway.mjs';

function fakeAdapter(id: 'openai' | 'gemini' | 'codex-sovereign') {
  return {
    descriptor: () => ({ id, configured: true, verified: false, capabilities: ['generation', 'reasoning'], profiles: ['fast', 'balanced', 'deep'], model: `${id}-model` }),
    probe: async () => ({ configured: true, verified: true, provider: id, model: `${id}-model`, error: null }),
    execute: async () => ({ provider: id, model: `${id}-model`, text: `${id} reply`, capabilities_used: ['generation'], usage: {}, provenance: [], tool_calls: [] }),
  };
}

function fakeStore() {
  const conversations = new Map<string, any>();
  const messages = new Map<string, any[]>();
  const requests = new Map<string, any>();
  let conversationCount = 0;
  let requestCount = 0;
  return {
    createConversation: async ({ module, title }: any) => {
      const id = `conversation-${++conversationCount}`;
      const value = { id, module, title };
      conversations.set(id, value);
      messages.set(id, []);
      return value;
    },
    getConversation: async ({ id }: any) => {
      const value = conversations.get(id);
      if (!value) throw Object.assign(new Error('conversation_not_found'), { code: 'conversation_not_found', status: 404 });
      return value;
    },
    appendMessage: async ({ conversation_id, role, content, provenance = [], trace_id }: any) => {
      const item = { role, content, provenance, trace_id };
      messages.get(conversation_id)?.push(item);
      return item;
    },
    listMessages: async ({ conversation_id }: any) => messages.get(conversation_id) ?? [],
    startRequest: async (value: any) => {
      const item = { id: `request-${++requestCount}`, ...value };
      requests.set(item.id, item);
      return item;
    },
    completeRequest: async ({ id, ...patch }: any) => Object.assign(requests.get(id), patch),
    failRequest: async ({ id, ...patch }: any) => Object.assign(requests.get(id), patch),
    _messages: messages,
  };
}

const routeProviders = [
  { id: 'openai', configured: true, verified: true, capabilities: ['generation', 'reasoning'], profiles: ['fast', 'balanced', 'deep'] },
  { id: 'gemini', configured: true, verified: true, capabilities: ['generation', 'reasoning'], profiles: ['fast', 'balanced', 'deep'] },
  { id: 'codex-sovereign', configured: true, verified: true, capabilities: ['generation', 'reasoning'], profiles: ['fast', 'balanced', 'deep'] },
];

function makeGateway(costPolicy: any = { allowed_providers: ['openai', 'gemini', 'codex-sovereign'], allow_paid_single: true, allow_council: true, zero_cost_providers: ['codex-sovereign'] }) {
  const adapters = [fakeAdapter('openai'), fakeAdapter('gemini'), fakeAdapter('codex-sovereign')];
  const registry = createProviderRegistry({ providers: adapters });
  const router = createIntelligenceRouter({ providers: routeProviders });
  const store = fakeStore();
  const council = createCouncilOrchestrator({ registry });
  return { gateway: createIntelligenceGateway({ router, registry, council, store, costPolicy, toolGateway: createToolGateway() }), store };
}

describe('ATLAS Unified AI gateway', () => {
  it('keeps one conversation while switching from OpenAI to Gemini', async () => {
    const { gateway } = makeGateway();
    const context = { organization_id: 'org-1', user_id: 'user-1', request_id: 'req-1', permissions: ['intelligence.use'] };
    const first = await gateway.execute({ context, request: { message: 'First', mode: 'openai', intent: 'balanced' } });
    const second = await gateway.execute({ context, request: { message: 'Second', conversation_id: first.conversation_id, mode: 'gemini', intent: 'balanced' } });
    expect(second.conversation_id).toBe(first.conversation_id);
    expect(first.provider).toBe('openai');
    expect(second.provider).toBe('gemini');
    expect(second.mode).toBe('gemini');
  });

  it('returns governed tool proposal metadata without executing side effects', async () => {
    const openai = fakeAdapter('openai');
    openai.execute = async () => ({
      provider: 'openai', model: 'openai-model', text: 'proposal', capabilities_used: ['generation'], usage: {}, provenance: [],
      tool_calls: [{ tool_name: 'records.update', arguments: { id: '1' }, risk_class: 'mutation', required_permissions: ['records.write'], side_effect: 'external', cost_class: 'none' }],
    });
    const registry = createProviderRegistry({ providers: [openai] });
    const router = createIntelligenceRouter({ providers: [routeProviders[0]] });
    const store = fakeStore();
    const gateway = createIntelligenceGateway({ router, registry, store, costPolicy: { allowed_providers: ['openai'], allow_paid_single: true, allow_council: false, zero_cost_providers: [] }, toolGateway: createToolGateway() });
    const result = await gateway.execute({ context: { organization_id: 'org-1', user_id: 'user-1', request_id: 'req-2', permissions: ['intelligence.use', 'records.write'] }, request: { message: 'Update', mode: 'openai' } });
    expect(result.tool_proposals.approval_required).toHaveLength(1);
    expect(result.tools_used).toEqual([]);
  });

  it('requires cost approval when Council is not pre-authorized', async () => {
    const { gateway } = makeGateway({ allowed_providers: ['openai', 'gemini'], allow_paid_single: true, allow_council: false, zero_cost_providers: [] });
    await expect(gateway.execute({
      context: { organization_id: 'org-1', user_id: 'user-1', request_id: 'req-3', permissions: ['intelligence.use'] },
      request: { message: 'Council', mode: 'council' },
    })).rejects.toMatchObject({ code: 'cost_approval_required' });
  });
});
