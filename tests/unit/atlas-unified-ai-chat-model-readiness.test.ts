import { describe, expect, it, vi } from 'vitest';
import { createOpenAIResponsesAdapter } from '../../supabase/functions/atlas-copilot/openai-responses-adapter.mjs';
import { createGeminiAdapter } from '../../supabase/functions/atlas-copilot/gemini-adapter.mjs';
import { createProviderRegistry } from '../../supabase/functions/atlas-copilot/provider-registry.mjs';

const context = { organization_id: 'org-1', user_id: 'user-1' };

describe('ATLAS model-specific provider readiness', () => {
  it('probes the explicitly requested OpenAI model instead of substituting the profile model', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toBe('https://api.openai.com/v1/models/gpt-6.1-sol');
      return new Response(JSON.stringify({ id: 'gpt-6.1-sol' }), { status: 200 });
    });
    const adapter = createOpenAIResponsesAdapter({
      apiKey: 'test-key',
      models: { balanced: 'gpt-6-astra' },
      fetchFn,
    });

    await expect(adapter.probe({ profile: 'balanced', model: 'gpt-6.1-sol' })).resolves.toMatchObject({
      provider: 'openai',
      model: 'gpt-6.1-sol',
      configured: true,
      verified: true,
      error: null,
    });
  });

  it('does not mark an announced Gemini model verified when the provider probe rejects it', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toContain('/v1beta/models/gemini-4-argon');
      return new Response(JSON.stringify({ error: { message: 'not available' } }), { status: 404 });
    });
    const adapter = createGeminiAdapter({
      apiKey: 'test-key',
      models: { deep: 'gemini-configured' },
      announcedModels: ['gemini-4-argon'],
      fetchFn,
    });

    expect(adapter.descriptor()).toMatchObject({
      model_discovery: [{ model: 'gemini-4-argon', state: 'announced_unverified' }],
    });
    const result = await adapter.probe({ profile: 'deep', model: 'gemini-4-argon' });
    expect(result.verified).toBe(false);
    expect(result.model).toBe('gemini-4-argon');
    expect(result.error).not.toBeNull();
    expect(result.model_verification_state).toBe('announced_unverified');
  });

  it('propagates model-specific verification through the provider registry', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toContain('/v1beta/models/gemini-4-argon');
      return new Response(JSON.stringify({ name: 'models/gemini-4-argon' }), { status: 200 });
    });
    const gemini = createGeminiAdapter({
      apiKey: 'test-key',
      models: { deep: 'gemini-configured' },
      announcedModels: ['gemini-4-argon'],
      fetchFn,
    });
    const registry = createProviderRegistry({ providers: [gemini] });

    const readiness = await registry.readiness({ profile: 'deep', model: 'gemini-4-argon', provider: 'gemini' });
    expect(readiness.find((item: any) => item.id === 'gemini')).toMatchObject({
      model: 'gemini-4-argon',
      verified: true,
      model_verification_state: 'verified',
    });
  });

  it('uses provider-reported OpenAI usage without fabricating cache savings', async () => {
    const providerUsage = {
      input_tokens: 100,
      output_tokens: 20,
      input_tokens_details: { cached_tokens: 80 },
    };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      id: 'resp-1',
      model: 'gpt-6.1-sol',
      output: [{ content: [{ type: 'output_text', text: 'ok' }] }],
      usage: providerUsage,
    }), { status: 200 }));
    const adapter = createOpenAIResponsesAdapter({
      apiKey: 'test-key',
      models: { balanced: 'gpt-6.1-sol' },
      fetchFn,
    });

    const result = await adapter.execute({
      context,
      route: { profile: 'balanced', capabilities: ['generation'] },
      instructions: 'ATLAS',
      input: [{ role: 'user', content: 'hello' }],
    });
    expect(result.usage).toEqual(providerUsage);
    expect(result.usage).not.toHaveProperty('estimated_cache_savings_usd');
  });
});
