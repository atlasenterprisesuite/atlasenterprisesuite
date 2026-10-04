import { describe, expect, it, vi } from 'vitest';
import { createAgentRuntimeRegistry } from '../../supabase/functions/atlas-copilot/agent-runtime.mjs';
import { createOpenAIAgentsRuntime } from '../../supabase/functions/atlas-copilot/openai-agents-runtime.mjs';

const context = {
  organization_id: 'org-1',
  user_id: 'user-1',
  session_id: 'atlas-session-1',
  request_id: 'atlas-request-1',
  permissions: ['records.read'],
};
const route = {
  provider: 'openai',
  providers: ['openai'],
  profile: 'balanced',
  model: 'gpt-6.1-sol',
  model_verification_state: 'verified',
  capabilities: ['generation', 'reasoning'],
};
const request = {
  context,
  route,
  trace_id: 'trace-1',
  instructions: 'ATLAS governed runtime',
  input: [{ role: 'user', content: 'Look up record 1.' }],
  tool_policy: {
    tools: [{
      name: 'records.lookup',
      description: 'Read one record',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
      risk_class: 'read-only',
      required_permissions: ['records.read'],
      side_effect: 'none',
      cost_class: 'none',
    }],
    computer_use: true,
  },
};

describe('ATLAS managed agent runtime', () => {
  it('keeps the managed runtime disabled by default', async () => {
    const fetchFn = vi.fn();
    const runtime = createOpenAIAgentsRuntime({ apiKey: 'test', enabled: false, fetchFn });
    await expect(runtime.execute(request)).rejects.toMatchObject({ code: 'runtime_not_enabled' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('registers managed runtimes without changing provider identity', () => {
    const runtime = createOpenAIAgentsRuntime({ apiKey: 'test', enabled: false, fetchFn: vi.fn() });
    const registry = createAgentRuntimeRegistry({ runtimes: [runtime] });
    expect(registry.get('openai-agents')).toBe(runtime);
    expect(registry.ids()).toEqual(['openai-agents']);
    expect(route.provider).toBe('openai');
  });

  it('rejects unsupported managed execution environments before provider traffic', async () => {
    const fetchFn = vi.fn();
    const runtime = createOpenAIAgentsRuntime({ apiKey: 'test', enabled: true, environment: 'privileged_magic', fetchFn });
    await expect(runtime.execute(request)).rejects.toMatchObject({ code: 'invalid_runtime_environment' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('uses the Agents API beta session contract and returns function calls as ATLAS proposals', async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://api.openai.com/v1/agents/sessions');
      expect(init?.method).toBe('POST');
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer test');
      expect(headers.get('OpenAI-Beta')).toBe('agents=v1');
      const body = JSON.parse(String(init?.body));
      expect(body.environment).toEqual({ type: 'openai_hosted' });
      expect(body.agent.model).toBe('gpt-6.1-sol');
      expect(body.agent.instructions).toBe('ATLAS governed runtime');
      expect(body.agent.tools).toEqual([expect.objectContaining({ type: 'function', name: 'records.lookup' })]);
      expect(JSON.stringify(body.agent.tools)).not.toContain('organization_id');
      expect(JSON.stringify(body.agent.tools)).not.toContain('user_id');
      expect(body.stream).toBe(false);
      return new Response(JSON.stringify({
        id: 'sess_1',
        object: 'agent.session',
        status: 'requires_action',
        environment: { type: 'openai_hosted' },
        required_actions: [{
          type: 'function_call',
          turn_id: 'turn_1',
          call_id: 'call_1',
          name: 'records.lookup',
          arguments: { id: '1' },
        }],
        usage: { input_tokens: 9, output_tokens: 2, total_tokens: 11 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const runtime = createOpenAIAgentsRuntime({ apiKey: 'test', enabled: true, environment: 'openai_hosted', allowComputerUse: false, fetchFn });
    const result = await runtime.execute(request);
    expect(result).toMatchObject({
      runtime: 'openai-agents',
      provider: 'openai',
      model: 'gpt-6.1-sol',
      provider_session_id: 'sess_1',
      execution_state: 'requires_action',
    });
    expect(result.tool_calls).toEqual([expect.objectContaining({
      provider: 'openai',
      tool_name: 'records.lookup',
      arguments: { id: '1' },
      risk_class: 'read-only',
      required_permissions: ['records.read'],
      side_effect: 'none',
      cost_class: 'none',
      provider_session_id: 'sess_1',
      provider_turn_id: 'turn_1',
      provider_call_id: 'call_1',
    })]);
    expect(result.tools_executed ?? []).toHaveLength(0);
  });

  it('does not enable computer use unless ATLAS runtime policy explicitly allows it', async () => {
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(JSON.stringify(body.agent.tools)).not.toMatch(/computer/i);
      return new Response(JSON.stringify({
        id: 'sess_2', object: 'agent.session', status: 'idle', environment: { type: 'openai_hosted' }, required_actions: [], usage: {},
      }), { status: 200 });
    });
    const runtime = createOpenAIAgentsRuntime({ apiKey: 'test', enabled: true, environment: 'openai_hosted', allowComputerUse: false, fetchFn });
    const result = await runtime.execute(request);
    expect(result.execution_state).not.toBe('completed');
  });

  it('does not turn an idle or partial managed session into completed', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      id: 'sess_partial', object: 'agent.session', status: 'idle', environment: { type: 'none' }, required_actions: [], usage: {},
    }), { status: 200 }));
    const runtime = createOpenAIAgentsRuntime({ apiKey: 'test', enabled: true, environment: 'none', fetchFn });
    const result = await runtime.execute({ ...request, tool_policy: { tools: [], computer_use: false } });
    expect(result.execution_state).toBe('incomplete');
    expect(result.status).toBe('idle');
  });

  it('records provider-session cleanup failure without treating ATLAS state as deleted', async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://api.openai.com/v1/agents/sessions/session-1');
      expect(init?.method).toBe('DELETE');
      return new Response(JSON.stringify({ error: { message: 'unavailable' } }), { status: 503 });
    });
    const runtime = createOpenAIAgentsRuntime({ apiKey: 'test', enabled: true, fetchFn });
    const cleanup = await runtime.cleanup({ provider_session_id: 'session-1' });
    expect(cleanup).toMatchObject({ attempted: true, deleted: false, reason: 'provider_unavailable' });
    expect(cleanup).not.toHaveProperty('atlas_conversation_deleted', true);
  });
});
