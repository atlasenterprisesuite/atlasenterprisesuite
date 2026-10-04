import { describe, expect, it, vi } from 'vitest';
import { createOpenAIAgentsAdapter } from '../../supabase/functions/atlas-copilot/openai-agents-adapter.mjs';
import { createAgentSessionRuntime } from '../../supabase/functions/atlas-copilot/agent-session-runtime.mjs';

const context = {
  organization_id: 'org-1',
  user_id: 'user-1',
  permissions: ['intelligence.use'],
};

describe('OpenAI Agents adapter', () => {
  it('creates governed computer-use and multi-agent sessions with the required beta contract', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const adapter = createOpenAIAgentsAdapter({
      apiKey: 'secret-test-key',
      models: { balanced: 'gpt-test' },
      fetchFn: async (url: string, init: RequestInit = {}) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ id: 'provider-session-1', status: 'ready' }), { status: 200 });
      },
    });

    const result = await adapter.createSession({
      profile: 'balanced',
      instructions: 'Operate only under ATLAS policy.',
      computer_use: true,
      multi_agent: true,
      max_concurrent_subagents: 3,
      network_allowlist: ['https://developers.openai.com'],
    });

    expect(result.session_id).toBe('provider-session-1');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.openai.com/v1/agents/sessions');
    expect((calls[0].init.headers as Record<string, string>)['OpenAI-Beta']).toBe('agents=v1');
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer secret-test-key');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.agent.model).toBe('gpt-test');
    expect(body.agent.tools).toContainEqual({ type: 'computer_use' });
    expect(body.agent.multi_agent).toEqual({ enabled: true, max_concurrent_subagents: 3 });
    expect(body.environment).toMatchObject({ type: 'openai_hosted', desktop: { enabled: true } });
    expect(JSON.stringify(body)).not.toContain('secret-test-key');
  });

  it('sends turns and approval results through the session events endpoint', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const adapter = createOpenAIAgentsAdapter({
      apiKey: 'key',
      models: { balanced: 'gpt-test' },
      fetchFn: async (url: string, init: RequestInit = {}) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      },
    });

    await adapter.sendInput({ session_id: 'provider-session-1', text: 'Inspect the page.', idempotency_key: 'turn-1' });
    await adapter.submitApproval({
      session_id: 'provider-session-1',
      request_id: 'approval-1',
      response: { type: 'browser_origin_access', decision: 'approve' },
    });

    expect(calls.map(call => call.url)).toEqual([
      'https://api.openai.com/v1/agents/sessions/provider-session-1/events',
      'https://api.openai.com/v1/agents/sessions/provider-session-1/events',
    ]);
    expect((calls[0].init.headers as Record<string, string>)['Idempotency-Key']).toBe('turn-1');
    expect(JSON.parse(String(calls[0].init.body)).events[0].type).toBe('agent.session.input.message');
    expect(JSON.parse(String(calls[1].init.body)).events[0]).toMatchObject({
      type: 'agent.session.input.computer_use_approval_request_result',
      request_id: 'approval-1',
    });
  });
});

describe('ATLAS agent session runtime', () => {
  it('persists an ATLAS-owned session id and provider mapping instead of exposing provider state as authority', async () => {
    const store = {
      createConversation: vi.fn(async () => ({ id: 'conv-1' })),
      startRequest: vi.fn(async () => ({ id: 'request-1' })),
      markBackgroundStarted: vi.fn(async () => ({ id: 'request-1' })),
      getRequestByTrace: vi.fn(),
      completeRequest: vi.fn(),
      failRequest: vi.fn(),
    };
    const adapter = {
      descriptor: () => ({ configured: true }),
      createSession: vi.fn(async () => ({ session_id: 'provider-session-1', status: 'ready', model: 'gpt-test' })),
    };
    const runtime = createAgentSessionRuntime({ adapter, store, idFactory: () => 'atlas-session-1' });

    const session = await runtime.createSession({ context, profile: 'balanced', instructions: 'Test' });

    expect(session.session_id).toBe('atlas-session-1');
    expect(session.provider_session_id).toBeUndefined();
    expect(store.startRequest).toHaveBeenCalledWith(expect.objectContaining({ trace_id: 'atlas-session-1', module: 'agent-session' }));
    expect(store.markBackgroundStarted).toHaveBeenCalledWith(expect.objectContaining({
      id: 'request-1',
      usage: expect.objectContaining({
        atlas_agent_session: expect.objectContaining({ provider_session_id: 'provider-session-1' }),
      }),
    }));
  });

  it('fails closed without intelligence.use permission before contacting a provider', async () => {
    const adapter = { createSession: vi.fn() };
    const store = {};
    const runtime = createAgentSessionRuntime({ adapter, store, idFactory: () => 'atlas-session-1' });

    await expect(runtime.createSession({
      context: { organization_id: 'org-1', user_id: 'user-1', permissions: [] },
      profile: 'balanced',
      instructions: 'Test',
    })).rejects.toMatchObject({ code: 'permission_denied', status: 403 });
    expect(adapter.createSession).not.toHaveBeenCalled();
  });

  it('normalizes provider computer-use required actions into ATLAS approval-required decisions', async () => {
    const store = {
      getRequestByTrace: vi.fn(async () => ({
        id: 'request-1',
        usage: { atlas_agent_session: { provider_session_id: 'provider-session-1', model: 'gpt-test' } },
      })),
    };
    const adapter = {
      retrieveSession: vi.fn(async () => ({
        id: 'provider-session-1',
        required_actions: [{
          type: 'computer_use_approval_request',
          request_id: 'approval-1',
          request: { type: 'browser_origin_access', origin: 'https://example.com', reason: 'Need page access' },
        }],
      })),
    };
    const runtime = createAgentSessionRuntime({ adapter, store, idFactory: () => 'unused' });

    const session = await runtime.getSession({ context, session_id: 'atlas-session-1' });

    expect(session.approvals).toEqual([expect.objectContaining({
      status: 'approval_required',
      request_id: 'approval-1',
      risk_class: 'computer_use',
      origin: 'https://example.com',
    })]);
  });
});
