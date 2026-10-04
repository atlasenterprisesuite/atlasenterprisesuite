import { describe, expect, it } from 'vitest';
import { createProviderRegistry } from '../../supabase/functions/atlas-copilot/provider-registry.mjs';
import { createOpenAIResponsesAdapter } from '../../supabase/functions/atlas-copilot/openai-responses-adapter.mjs';
import { createGeminiAdapter } from '../../supabase/functions/atlas-copilot/gemini-adapter.mjs';

const featureShape = {
  background: false,
  multi_agent: false,
  computer_use: false,
  function_calling: false,
  remote_mcp: false,
  programmatic_tool_calling: false,
  dynamic_workflows: false,
};

describe('ATLAS agentic provider capability descriptors', () => {
  it('normalizes every provider readiness descriptor to the full ATLAS agentic feature shape', async () => {
    const registry = createProviderRegistry({
      providers: [{
        descriptor: () => ({
          id: 'openai',
          configured: true,
          capabilities: ['generation', 'reasoning'],
          profiles: ['balanced'],
          feature_support: { background: true },
        }),
        probe: async () => ({ configured: true, verified: true, provider: 'openai', model: 'test-model' }),
      }],
    });

    const [openai] = await registry.readiness({ profile: 'balanced' });
    expect(openai.feature_support).toEqual({ ...featureShape, background: true });
  });

  it('exposes truthful complete feature support for the current OpenAI Responses adapter', () => {
    const adapter = createOpenAIResponsesAdapter({
      apiKey: 'test-key',
      models: { balanced: 'test-model' },
      fetchFn: async () => new Response('{}', { status: 200 }),
    });

    expect(adapter.descriptor().feature_support).toEqual({
      ...featureShape,
      background: true,
    });
  });

  it('exposes truthful complete feature support for Gemini before tool execution is enabled', () => {
    const adapter = createGeminiAdapter({
      apiKey: 'test-key',
      models: { balanced: 'test-model' },
      fetchFn: async () => new Response('{}', { status: 200 }),
    });

    expect(adapter.descriptor().feature_support).toEqual(featureShape);
  });
});
