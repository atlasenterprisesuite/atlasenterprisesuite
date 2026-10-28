import { describe, expect, it } from 'vitest';
import { createIntelligenceGateway, createIntelligenceRouter } from '../../supabase/functions/atlas-copilot/intelligence-gateway.mjs';
import { createProviderRegistry } from '../../supabase/functions/atlas-copilot/provider-registry.mjs';
import { createCouncilOrchestrator } from '../../supabase/functions/atlas-copilot/council-orchestrator.mjs';
import { createToolGateway } from '../../supabase/functions/atlas-copilot/tool-gateway.mjs';

function fakeAdapter(id: 'atlas-local' | 'openai' | 'gemini' | 'codex-sovereign', options: { failCode?: string } = {}) {
  return {
    descriptor: () => ({ id, configured: true, verified: false, capabilities: ['generation', 'reasoning'], profiles: ['fast', 'balanced', 'deep'], model: `${id}-model` }),
    probe: async () => ({ configured: true, verified: true, provider: id, model: `${id}-model`, error: null }),
    execute: async () => {
      if (options.failCode) throw Object.assign(new Error(options.failCode), { code: options.failCode, status: options.failCode === 'provider_rate_limited' ? 429 : 502 });
      return { provider: id, model: `${id}-model`, text: `${id} reply`, capabilities_used: ['generation'], usage: {}, provenance: [], tool_calls: [] };
    },
  };
}

function fakeStore(options: { emergencyAllowed?: boolean } = {}) {
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
    listRecentMessages: async ({ conversation_id, limit = 12 }: any) => (messages.get(conversation_id) ?? []).slice(-limit),
    startRequest: async (value: any) => {
      const item = { id: `request-${++requestCount}`, ...value };
      requests.set(item.id, item);
      return item;
    },
    reserveEmergencyBudget: async ({ reserve_usd, daily_budget_usd }: any) => options.emergencyAllowed
      ? { allowed: true, reason: 'emergency_budget_reserved', reservation_id: 'reservation-1', reserved_usd: reserve_usd, daily_budget_usd }
      : { allowed: false, reason: 'emergency_daily_budget_exhausted', remaining_usd: 0 },
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

const context = (request_id: string, permissions: string[]) => ({
  organization_id: 'org-1',
  user_id: 'user-1',
  session_id: 'session-1',
  request_id,
  permissions,
});

describe('ATLAS Unified AI gateway', () => {
  it('keeps one conversation while switching from OpenAI to Gemini', async () => {
    const { gateway } = makeGateway();
    const principal = context('req-1', ['intelligence.use']);
    const first = await gateway.execute({ context: principal, request: { message: 'First', mode: 'openai', intent: 'balanced' } });
    const second = await gateway.execute({ context: principal, request: { message: 'Second', conversation_id: first.conversation_id, mode: 'gemini', intent: 'balanced' } });
    expect(second.conversation_id).toBe(first.conversation_id);
    expect(first.provider).toBe('openai');
    expect(second.provider).toBe('gemini');
    expect(second.mode).toBe('gemini');
  });

  it('falls back from atlas-local to OpenAI after a transient runtime failure when policy allows it', async () => {
    const local = fakeAdapter('atlas-local', { failCode: 'provider_unavailable' });
    const openai = fakeAdapter('openai');
    const registry = createProviderRegistry({ providers: [local, openai] });
    const router = createIntelligenceRouter({
      providers: [
        { id: 'atlas-local', configured: true, verified: true, capabilities: ['generation', 'reasoning'], profiles: ['fast', 'balanced', 'deep'] },
        { id: 'openai', configured: true, verified: true, capabilities: ['generation', 'reasoning'], profiles: ['fast', 'balanced', 'deep'] },
      ],
      preferredProviders: ['atlas-local'],
    });
    const store = fakeStore();
    const gateway = createIntelligenceGateway({
      router,
      registry,
      store,
      costPolicy: { allowed_providers: ['atlas-local', 'openai'], enforce_zero_cost: false, allow_paid_single: true, allow_council: false, zero_cost_providers: ['atlas-local'] },
      toolGateway: createToolGateway(),
    });

    const result = await gateway.execute({
      context: context('req-fallback', ['intelligence.use']),
      request: { message: 'Recover automatically', mode: 'auto', intent: 'balanced' },
    });

    expect(result.provider).toBe('openai');
    expect(result.providers).toEqual(['openai']);
    expect(result.fallback_used).toBe(true);
    const stored = store._messages.get(result.conversation_id) ?? [];
    const assistant = stored.find((item: any) => item.role === 'assistant');
    expect(assistant?.content?.routing?.reason).toBe('runtime_fallback_after_provider_failure');
    expect(assistant?.content?.routing?.fallback_attempts).toEqual([
      { provider: 'atlas-local', outcome: 'provider_unavailable' },
      { provider: 'openai', outcome: 'completed' },
    ]);
  });

  it('does not bypass zero-cost policy when a paid fallback is not authorized', async () => {
    const local = fakeAdapter('atlas-local', { failCode: 'provider_unavailable' });
    const openai = fakeAdapter('openai');
    const registry = createProviderRegistry({ providers: [local, openai] });
    const router = createIntelligenceRouter({
      providers: [
        { id: 'atlas-local', configured: true, verified: true, capabilities: ['generation', 'reasoning'], profiles: ['fast', 'balanced', 'deep'] },
        { id: 'openai', configured: true, verified: true, capabilities: ['generation', 'reasoning'], profiles: ['fast', 'balanced', 'deep'] },
      ],
      preferredProviders: ['atlas-local'],
    });
    const store = fakeStore();
    const gateway = createIntelligenceGateway({
      router,
      registry,
      store,
      costPolicy: { allowed_providers: ['atlas-local', 'openai'], enforce_zero_cost: true, allow_paid_single: false, allow_council: false, zero_cost_providers: ['atlas-local'] },
      toolGateway: createToolGateway(),
    });

    await expect(gateway.execute({
      context: context('req-zero-cost', ['intelligence.use']),
      request: { message: 'Stay governed', mode: 'auto', intent: 'balanced' },
    })).rejects.toMatchObject({ code: 'provider_unavailable' });
  });

  it('uses budgeted OpenAI emergency fallback while zero-cost mode remains enforced', async () => {
    const local = fakeAdapter('atlas-local', { failCode: 'provider_unavailable' });
    const openai = fakeAdapter('openai');
    const registry = createProviderRegistry({ providers: [local, openai] });
    const router = createIntelligenceRouter({
      providers: [
        { id: 'atlas-local', configured: true, verified: true, capabilities: ['generation', 'reasoning'], profiles: ['fast', 'balanced', 'deep'] },
        { id: 'openai', configured: true, verified: true, capabilities: ['generation', 'reasoning'], profiles: ['fast', 'balanced', 'deep'] },
      ],
      preferredProviders: ['atlas-local'],
    });
    const store = fakeStore({ emergencyAllowed: true });
    const gateway = createIntelligenceGateway({
      router,
      registry,
      store,
      costPolicy: {
        allowed_providers: ['atlas-local', 'openai'],
        enforce_zero_cost: true,
        allow_paid_single: false,
        allow_council: false,
        zero_cost_providers: ['atlas-local'],
        emergency_openai_enabled: true,
        emergency_openai_daily_budget_usd: 1,
        emergency_openai_reserve_usd: 0.1,
        emergency_openai_max_output_tokens: 256,
      },
      toolGateway: createToolGateway(),
    });

    const result = await gateway.execute({
      context: context('req-emergency', ['intelligence.use']),
      request: { message: 'Recover under emergency budget', mode: 'auto', intent: 'balanced' },
    });

    expect(result.provider).toBe('openai');
    expect(result.fallback_used).toBe(true);
    expect(result.automatic_api_cost_usd).toBe(0.1);
    const stored = store._messages.get(result.conversation_id) ?? [];
    const assistant = stored.find((item: any) => item.role === 'assistant');
    expect(assistant?.content?.routing?.reason).toBe('runtime_emergency_fallback_after_provider_failure');
    expect(assistant?.content?.routing?.fallback_attempts).toEqual([
      { provider: 'atlas-local', outcome: 'provider_unavailable' },
      { provider: 'openai', outcome: 'completed', emergency: true, reservation_id: 'reservation-1', reserved_usd: 0.1 },
    ]);
  });

  it('fails closed when the emergency OpenAI budget is exhausted', async () => {
    const local = fakeAdapter('atlas-local', { failCode: 'provider_unavailable' });
    const openai = fakeAdapter('openai');
    const registry = createProviderRegistry({ providers: [local, openai] });
    const router = createIntelligenceRouter({
      providers: [
        { id: 'atlas-local', configured: true, verified: true, capabilities: ['generation', 'reasoning'], profiles: ['fast', 'balanced', 'deep'] },
        { id: 'openai', configured: true, verified: true, capabilities: ['generation', 'reasoning'], profiles: ['fast', 'balanced', 'deep'] },
      ],
      preferredProviders: ['atlas-local'],
    });
    const gateway = createIntelligenceGateway({
      router,
      registry,
      store: fakeStore({ emergencyAllowed: false }),
      costPolicy: {
        allowed_providers: ['atlas-local', 'openai'],
        enforce_zero_cost: true,
        allow_paid_single: false,
        allow_council: false,
        zero_cost_providers: ['atlas-local'],
        emergency_openai_enabled: true,
        emergency_openai_daily_budget_usd: 1,
        emergency_openai_reserve_usd: 0.1,
      },
      toolGateway: createToolGateway(),
    });

    await expect(gateway.execute({
      context: context('req-emergency-exhausted', ['intelligence.use']),
      request: { message: 'Do not overspend', mode: 'auto', intent: 'balanced' },
    })).rejects.toMatchObject({ code: 'emergency_budget_exhausted', status: 429 });
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
    const result = await gateway.execute({ context: context('req-2', ['intelligence.use', 'records.write']), request: { message: 'Update', mode: 'openai' } });
    expect(result.tool_proposals.approval_required).toHaveLength(1);
    expect(result.tools_used).toEqual([]);
  });

  it('requires cost approval when Council is not pre-authorized', async () => {
    const { gateway } = makeGateway({ allowed_providers: ['openai', 'gemini', 'codex-sovereign'], allow_paid_single: true, allow_council: false, zero_cost_providers: [] });
    await expect(gateway.execute({
      context: context('req-3', ['intelligence.use']),
      request: { message: 'Council', mode: 'council' },
    })).rejects.toMatchObject({ code: 'cost_approval_required' });
  });
  it('preserves demanding conversation effort across a short authorized follow-up', async () => {
    const { gateway, store } = makeGateway();
    const principal = context('req-context', ['intelligence.use']);
    const first = await gateway.execute({
      context: principal,
      request: { message: 'ATLAS 777 REVIEW — audita P0 y RLS para la organización.', intent: 'auto' },
    });
    const second = await gateway.execute({
      context: principal,
      request: { message: 'Continúa', conversation_id: first.conversation_id, intent: 'auto' },
    });
    expect(first.profile).toBe('deep');
    expect(second.profile).toBe('deep');
    expect(second.selection_reason).toBe('authorized_conversation_continuity');
    const messages = store._messages.get(first.conversation_id) ?? [];
    expect(messages.filter((item: any) => item.role === 'assistant').at(-1)?.content?.routing)
      .toMatchObject({ profile: 'deep', requested_profile: 'auto', selection_reason: 'authorized_conversation_continuity' });
  });

  it('does not inherit previous effort when the user explicitly selects fast', async () => {
    const { gateway } = makeGateway();
    const principal = context('req-manual', ['intelligence.use']);
    const first = await gateway.execute({
      context: principal,
      request: { message: 'ATLAS 777 REVIEW — audita P0', intent: 'auto' },
    });
    const second = await gateway.execute({
      context: principal,
      request: { message: 'Continúa', conversation_id: first.conversation_id, intent: 'fast' },
    });
    expect(second.profile).toBe('fast');
    expect(second.selection_reason).toBe('manual_selection');
  });

  it('fails closed after identity revocation during inference without persisting assistant text', async () => {
    const store = fakeStore();
    let revoked = false;
    const adapter = fakeAdapter('openai');
    adapter.execute = async () => {
      revoked = true;
      return { provider: 'openai', model: 'openai-model', text: 'PRIVATE_ORG_OUTPUT',
        capabilities_used: ['generation'], usage: {}, provenance: [], tool_calls: [] };
    };
    const registry = createProviderRegistry({ providers: [adapter] });
    const router = createIntelligenceRouter({ providers: [routeProviders[0]] });
    const gateway = createIntelligenceGateway({
      router, registry, store,
      costPolicy: { allowed_providers: ['openai'], allow_paid_single: true, zero_cost_providers: [] },
      reauthorize: async () => revoked
        ? { ...context('fresh', []), permissions: [] }
        : context('fresh', ['intelligence.use']),
    });
    await expect(gateway.execute({
      context: context('request-revoke', ['intelligence.use']),
      request: { message: 'Summarize organization records', intent: 'fast', mode: 'openai' },
    })).rejects.toMatchObject({ code: 'permission_denied', status: 403 });
    const serialized = JSON.stringify([...store._messages.values()]);
    expect(serialized).not.toContain('PRIVATE_ORG_OUTPUT');
  });

  it.each([
    { organization_id: 'org-other', user_id: 'user-1' },
    { organization_id: 'org-1', user_id: 'intruder' },
  ])('rejects identity changes between inference and response release', async (newPrincipal) => {
    const store = fakeStore();
    const adapter = fakeAdapter('openai');
    const registry = createProviderRegistry({ providers: [adapter] });
    const gateway = createIntelligenceGateway({
      router: createIntelligenceRouter({ providers: [routeProviders[0]] }), registry, store,
      costPolicy: { allowed_providers: ['openai'], allow_paid_single: true, zero_cost_providers: [] },
      reauthorize: async () => ({ ...context('fresh', ['intelligence.use']), ...newPrincipal }),
    });
    await expect(gateway.execute({
      context: context('request-identity', ['intelligence.use']),
      request: { message: 'Check accounting totals', mode: 'openai' },
    })).rejects.toMatchObject({ code: 'permission_denied', status: 403 });
    expect(JSON.stringify([...store._messages.values()])).not.toContain('openai reply');
  });

  it('stops response release when the auth source is unavailable (no silent fallback)', async () => {
    const store = fakeStore();
    const registry = createProviderRegistry({ providers: [fakeAdapter('openai')] });
    const gateway = createIntelligenceGateway({
      router: createIntelligenceRouter({ providers: [routeProviders[0]] }), registry, store,
      costPolicy: { allowed_providers: ['openai'], allow_paid_single: true, zero_cost_providers: [] },
      reauthorize: async () => { throw Object.assign(new Error('identity_unavailable'), { code: 'identity_unavailable', status: 502 }); },
    });
    await expect(gateway.execute({
      context: context('request-outage', ['intelligence.use']),
      request: { message: 'Private user information', mode: 'openai' },
    })).rejects.toMatchObject({ code: 'identity_unavailable', status: 502 });
    expect(JSON.stringify([...store._messages.values()])).not.toContain('openai reply');
  });

});
