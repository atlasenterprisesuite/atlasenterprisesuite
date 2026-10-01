import { describe, expect, it, vi } from 'vitest';
import { createBackgroundBrain, shouldRunInBackground } from '../../supabase/functions/atlas-copilot/background-brain.mjs';

const context = {
  organization_id: 'org-1',
  user_id: 'user-1',
  permissions: ['intelligence.use']
};

function createStore() {
  const conversation = { id: 'conversation-1' };
  const messages: any[] = [];
  const request: any = {
    id: 'request-1',
    trace_id: '',
    conversation_id: conversation.id,
    status: 'started',
    provider: null,
    model: null,
    usage: {},
    capabilities_requested: ['generation'],
    created_at: new Date().toISOString(),
    intent: 'balanced'
  };
  return {
    messages,
    request,
    createConversation: vi.fn(async () => conversation),
    getConversation: vi.fn(async () => conversation),
    appendMessage: vi.fn(async (input: any) => {
      const row = { id: 'message-' + (messages.length + 1), ...input };
      messages.push(row);
      return row;
    }),
    listMessages: vi.fn(async () => messages.map((message) => ({ role: message.role, content: message.content }))),
    startRequest: vi.fn(async (input: any) => {
      request.trace_id = input.trace_id;
      request.conversation_id = input.conversation_id;
      request.capabilities_requested = input.capabilities_requested;
      return { ...request };
    }),
    markBackgroundStarted: vi.fn(async (input: any) => {
      request.provider = input.provider;
      request.model = input.model;
      request.usage = input.usage;
      return { ...request };
    }),
    getRequestByTrace: vi.fn(async ({ trace_id }: any) => {
      if (trace_id !== request.trace_id) throw new Error('request_not_found');
      return { ...request };
    }),
    findAssistantMessageByTrace: vi.fn(async ({ trace_id }: any) =>
      messages.find((message) => message.role === 'assistant' && message.trace_id === trace_id) || null
    ),
    listBackgroundRequests: vi.fn(async () => request.status === 'started' ? [{ ...request }] : []),
    completeRequest: vi.fn(async (input: any) => {
      request.status = 'completed';
      request.provider = input.provider;
      request.model = input.model;
      request.usage = input.usage;
      return { ...request };
    }),
    failRequest: vi.fn(async (input: any) => {
      request.status = 'failed';
      request.error_code = input.error_code;
      return { ...request };
    })
  };
}

describe('ATLAS Background Brain', () => {
  it('keeps ordinary chat interactive and promotes genuinely long work', () => {
    expect(shouldRunInBackground({ executionMode: 'auto', message: 'Hello', profile: 'balanced' })).toBe(false);
    expect(shouldRunInBackground({ executionMode: 'background', message: 'Hello', profile: 'balanced' })).toBe(true);
    expect(shouldRunInBackground({ executionMode: 'interactive', message: 'Deep research everything', profile: 'deep' })).toBe(false);
    expect(shouldRunInBackground({ executionMode: 'auto', message: 'Research thoroughly ' + 'context '.repeat(80), profile: 'balanced' })).toBe(true);
    expect(shouldRunInBackground({ executionMode: 'auto', message: 'Short deep task', profile: 'deep' })).toBe(true);
  });

  it('starts a provider background task and persists its final answer exactly once', async () => {
    const store = createStore();
    const adapter = {
      startBackground: vi.fn(async () => ({
        provider: 'openai',
        model: 'gpt-6-astra',
        response_id: 'resp_bg_1',
        status: 'queued',
        text: null,
        usage: {}
      })),
      retrieveBackground: vi.fn(async () => ({
        provider: 'openai',
        model: 'gpt-6-astra',
        response_id: 'resp_bg_1',
        status: 'completed',
        text: 'Background result',
        usage: { output_tokens: 7 }
      }))
    };
    const registry = { get: (id: string) => id === 'openai' ? adapter : null };
    const router = {
      route: () => ({
        mode: 'openai',
        providers: ['openai'],
        provider: 'openai',
        profile: 'balanced',
        capabilities: ['generation'],
        fallback_used: false,
        reason: 'explicit_provider'
      })
    };
    const brain = createBackgroundBrain({
      router,
      registry,
      store,
      costPolicy: {
        allowed_providers: ['openai'],
        enforce_zero_cost: false,
        allow_paid_single: true,
        zero_cost_providers: []
      }
    });

    const started = await brain.start({
      context,
      request: {
        module: 'assistant',
        intent: 'balanced',
        mode: 'openai',
        message: 'Run a long task',
        capabilities_requested: ['generation']
      }
    });
    expect(started).toMatchObject({ background: true, status: 'queued', provider: 'openai' });
    expect(store.markBackgroundStarted).toHaveBeenCalledTimes(1);

    const completed = await brain.poll({ context, traceId: started.trace_id });
    expect(completed).toMatchObject({ background: true, status: 'completed', text: 'Background result' });
    expect(store.messages.filter((message: any) => message.role === 'assistant')).toHaveLength(1);
    expect(store.completeRequest).toHaveBeenCalledTimes(1);

    const secondPoll = await brain.poll({ context, traceId: started.trace_id });
    expect(secondPoll).toMatchObject({ status: 'completed', persisted: true });
    expect(store.messages.filter((message: any) => message.role === 'assistant')).toHaveLength(1);
  });

  it('does not bypass zero-cost policy to force a paid background provider', async () => {
    const store = createStore();
    const registry = {
      get: (id: string) => id === 'openai'
        ? { startBackground: vi.fn() }
        : { execute: vi.fn() }
    };
    const router = {
      route: () => ({
        mode: 'auto',
        providers: ['atlas-local'],
        fallback_providers: ['openai'],
        provider: 'atlas-local',
        profile: 'deep',
        capabilities: ['generation'],
        fallback_used: false,
        reason: 'auto_zero_cost_verified_provider'
      })
    };
    const brain = createBackgroundBrain({
      router,
      registry,
      store,
      costPolicy: {
        allowed_providers: ['atlas-local', 'openai'],
        enforce_zero_cost: true,
        allow_paid_single: false,
        zero_cost_providers: ['atlas-local']
      }
    });
    await expect(brain.start({
      context,
      request: {
        module: 'assistant',
        intent: 'deep',
        mode: 'auto',
        message: 'Deep research',
        capabilities_requested: ['generation']
      }
    })).rejects.toMatchObject({ code: 'background_provider_unavailable' });
  });
});
