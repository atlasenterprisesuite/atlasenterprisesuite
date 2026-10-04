import { describe, expect, it } from 'vitest';
import { createGeminiAdapter } from '../../supabase/functions/atlas-copilot/gemini-adapter.mjs';
import { createToolGateway } from '../../supabase/functions/atlas-copilot/tool-gateway.mjs';

const tool = {
  name: 'atlas_update_record',
  description: 'Update an ATLAS record after policy approval.',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' }, value: { type: 'string' } },
    required: ['id', 'value'],
  },
  risk_class: 'write',
  required_permissions: ['records.write'],
  side_effect: 'write',
  cost_class: 'none',
};

describe('Gemini function calls through ATLAS tool policy', () => {
  it('declares Gemini functions but returns provider calls only as normalized ATLAS proposals', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const adapter = createGeminiAdapter({
      apiKey: 'test-key',
      models: { balanced: 'gemini-test' },
      fetchFn: async (url: string, init: RequestInit = {}) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ functionCall: { id: 'fc-1', name: 'atlas_update_record', args: { id: 'r1', value: 'next' } } }] } }],
          usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 6 },
        }), { status: 200 });
      },
    });

    const result = await adapter.execute({
      route: { profile: 'balanced', capabilities: ['generation', 'tool-use'] },
      instructions: 'Use tools only when needed.',
      input: [{ role: 'user', content: 'Update record r1.' }],
      tools: [tool],
    });

    const body = JSON.parse(String(calls[0].init.body));
    expect(body.tools).toEqual([{ functionDeclarations: [expect.objectContaining({
      name: 'atlas_update_record',
      description: tool.description,
      parameters: tool.parameters,
    })] }]);
    expect(result.text).toBe('');
    expect(result.tool_calls).toEqual([{
      tool_name: 'atlas_update_record',
      arguments: { id: 'r1', value: 'next' },
      risk_class: 'write',
      required_permissions: ['records.write'],
      side_effect: 'write',
      cost_class: 'none',
      provider: 'gemini',
      provider_call_id: 'fc-1',
    }]);
  });

  it('fails closed on malformed Gemini function-call arguments', async () => {
    const adapter = createGeminiAdapter({
      apiKey: 'test-key',
      models: { balanced: 'gemini-test' },
      fetchFn: async () => new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ functionCall: { id: 'fc-2', name: 'atlas_update_record', args: 'not-an-object' } }] } }],
      }), { status: 200 }),
    });

    await expect(adapter.execute({
      route: { profile: 'balanced' },
      instructions: 'Test',
      input: [{ role: 'user', content: 'Test' }],
      tools: [tool],
    })).rejects.toMatchObject({ code: 'provider_invalid_tool_call' });
  });

  it('routes a Gemini write proposal into approval_required instead of executing it', async () => {
    const adapter = createGeminiAdapter({
      apiKey: 'test-key',
      models: { balanced: 'gemini-test' },
      fetchFn: async () => new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ functionCall: { name: 'atlas_update_record', args: { id: 'r1', value: 'next' } } }] } }],
      }), { status: 200 }),
    });
    const result = await adapter.execute({ route: { profile: 'balanced' }, instructions: 'Test', input: [], tools: [tool] });
    const decision = createToolGateway().evaluate({ proposals: result.tool_calls, context: { permissions: ['records.write'] } });

    expect(decision.accepted).toHaveLength(0);
    expect(decision.denied).toHaveLength(0);
    expect(decision.approval_required).toEqual([expect.objectContaining({
      tool_name: 'atlas_update_record',
      provider: 'gemini',
      decision_reason: 'side_effect_approval_required',
    })]);
  });
});
