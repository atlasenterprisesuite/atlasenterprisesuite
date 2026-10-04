import { existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const ROOT = '../../supabase/functions/atlas-copilot/';
const MODEL_CATALOG = 'supabase/functions/atlas-copilot/model-catalog.mjs';
const ANTHROPIC_ADAPTER = 'supabase/functions/atlas-copilot/anthropic-messages-adapter.mjs';
const OPENAI_AGENT_RUNTIME = 'supabase/functions/atlas-copilot/openai-agent-runtime.mjs';
const SECURITY_TASKFLOWS = 'supabase/functions/atlas-copilot/security-taskflows.mjs';

describe('ATLAS October 2026 AI stack modernization', () => {
  it('centralizes current OpenAI and Anthropic model defaults', async () => {
    expect(existsSync(MODEL_CATALOG)).toBe(true);
    if (!existsSync(MODEL_CATALOG)) return;
    const module = await import(ROOT + 'model-catalog.mjs');
    expect(module.defaultProfileModels('openai')).toEqual({
      fast: 'gpt-6-luna',
      balanced: 'gpt-6.1-sol',
      deep: 'gpt-6-astra',
    });
    expect(module.defaultProfileModels('anthropic')).toEqual({
      fast: 'claude-sonnet-5-5',
      balanced: 'claude-sonnet-5-5',
      deep: 'claude-sonnet-5-5',
    });
    expect(Object.isFrozen(module.MODEL_CATALOG)).toBe(true);
  });

  it('executes Claude Sonnet 5.5 through a fail-closed Anthropic adapter', async () => {
    expect(existsSync(ANTHROPIC_ADAPTER)).toBe(true);
    if (!existsSync(ANTHROPIC_ADAPTER)) return;
    const { createAnthropicMessagesAdapter } = await import(ROOT + 'anthropic-messages-adapter.mjs');
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      const headers = new Headers(init?.headers);
      expect(headers.get('x-api-key')).toBe('anthropic-secret');
      expect(headers.get('anthropic-version')).toBeTruthy();
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('claude-sonnet-5-5');
      return new Response(JSON.stringify({
        id: 'msg_1',
        model: 'claude-sonnet-5-5',
        content: [{ type: 'text', text: 'anthropic-ok' }],
        usage: { input_tokens: 3, output_tokens: 2 },
      }), { status: 200 });
    });
    const adapter = createAnthropicMessagesAdapter({
      apiKey: 'anthropic-secret',
      models: { balanced: 'claude-sonnet-5-5' },
      fetchFn,
    });
    expect(adapter.descriptor()).toMatchObject({ id: 'anthropic', configured: true });
    const result = await adapter.execute({
      context: { organization_id: 'org-1', user_id: 'user-1' },
      route: { profile: 'balanced', capabilities: ['generation'] },
      instructions: 'ATLAS',
      input: [{ role: 'user', content: 'hello' }],
    });
    expect(result).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-5-5', text: 'anthropic-ok' });
  });

  it('provides an explicit OpenAI hosted computer-use lifecycle without auto approval', async () => {
    expect(existsSync(OPENAI_AGENT_RUNTIME)).toBe(true);
    if (!existsSync(OPENAI_AGENT_RUNTIME)) return;
    const { createOpenAIAgentRuntime } = await import(ROOT + 'openai-agent-runtime.mjs');
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://api.openai.com/v1/agents/sessions' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(body.agent.model).toBe('gpt-6.1-sol');
        expect(body.agent.tools).toEqual([{ type: 'computer_use', include_screenshots: false }]);
        return new Response(JSON.stringify({ id: 'sess_1', status: 'ready', required_actions: [] }), { status: 200 });
      }
      if (url === 'https://api.openai.com/v1/agents/sessions/sess_1' && !init?.method) {
        return new Response(JSON.stringify({
          id: 'sess_1',
          status: 'requires_action',
          required_actions: [{ type: 'computer_use_approval_request', request: { origin: 'https://example.com' } }],
        }), { status: 200 });
      }
      if (url === 'https://api.openai.com/v1/agents/sessions/sess_1/items') {
        return new Response(JSON.stringify({ data: [{ id: 'item_1', type: 'computer_activity' }] }), { status: 200 });
      }
      if (url === 'https://api.openai.com/v1/agents/sessions/sess_1' && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ id: 'sess_1', deleted: true }), { status: 200 });
      }
      throw new Error('unexpected_request');
    });
    const runtime = createOpenAIAgentRuntime({ apiKey: 'openai-secret', model: 'gpt-6.1-sol', fetchFn });
    expect((await runtime.createSession({ instructions: 'Read only.', includeScreenshots: false })).id).toBe('sess_1');
    const session = await runtime.getSession({ sessionId: 'sess_1' });
    expect(session.required_actions).toHaveLength(1);
    expect(session.required_actions[0].type).toBe('computer_use_approval_request');
    expect((await runtime.listItems({ sessionId: 'sess_1' })).data).toHaveLength(1);
    expect(await runtime.deleteSession({ sessionId: 'sess_1' })).toMatchObject({ deleted: true });
    expect(fetchFn.mock.calls.some(([, init]) => String(init?.body || '').includes('approval_request_result'))).toBe(false);
  });

  it('defines the immutable authorized-code-audit v1 security taskflow', async () => {
    expect(existsSync(SECURITY_TASKFLOWS)).toBe(true);
    if (!existsSync(SECURITY_TASKFLOWS)) return;
    const { getSecurityTaskflow, createSecurityExecutionPlan } = await import(ROOT + 'security-taskflows.mjs');
    const flow = getSecurityTaskflow('authorized-code-audit', 'v1');
    expect(flow.steps.map((step: { id: string }) => step.id)).toEqual([
      'recon',
      'hypothesis',
      'code_search',
      'vulnerability_analysis',
      'exploitability_check',
      'evidence',
      'remediation',
      'regression_test',
    ]);
    expect(Object.isFrozen(flow)).toBe(true);
    const plan = createSecurityExecutionPlan({ id: 'authorized-code-audit', version: 'v1', target: 'repo:atlas' });
    expect(plan).toMatchObject({ id: 'authorized-code-audit', version: 'v1', target: 'repo:atlas' });
    expect(() => getSecurityTaskflow('missing', 'v1')).toThrow(/taskflow_not_found/);
  });
});
