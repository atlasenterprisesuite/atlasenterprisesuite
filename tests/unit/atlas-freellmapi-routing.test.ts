import { describe, expect, it } from 'vitest';
import { createIntelligenceRouter } from '../../supabase/functions/atlas-copilot/intelligence-gateway.mjs';

const provider = (id: string, feature_support: Record<string, boolean> = {}) => ({
  id,
  configured: true,
  verified: true,
  capabilities: ['generation', 'reasoning'],
  profiles: ['fast', 'balanced', 'deep'],
  feature_support,
});

describe('ATLAS FreeLLMAPI routing policy', () => {
  it('allows FreeLLMAPI as a verified preferred auto provider', () => {
    const router = createIntelligenceRouter({
      providers: [provider('openai'), provider('freellmapi', { aggregate_router: true })],
      preferredProviders: ['freellmapi'],
    });
    expect(router.route({ mode: 'auto', intent: 'balanced', capabilities_requested: ['generation'] })).toMatchObject({
      provider: 'freellmapi',
      providers: ['freellmapi'],
      reason: 'auto_zero_cost_verified_provider',
    });
  });

  it('does not expose FreeLLMAPI as an explicit user provider mode', () => {
    const router = createIntelligenceRouter({
      providers: [provider('freellmapi', { aggregate_router: true })],
    });
    expect(() => router.route({ mode: 'freellmapi', intent: 'balanced', capabilities_requested: ['generation'] }))
      .toThrowError(/invalid_input/);
  });

  it('excludes aggregate routers from Council quorum', () => {
    const router = createIntelligenceRouter({
      providers: [
        provider('openai'),
        provider('gemini'),
        provider('freellmapi', { aggregate_router: true }),
      ],
    });
    expect(router.route({ mode: 'council', intent: 'balanced', capabilities_requested: ['generation'] }))
      .toMatchObject({ providers: ['openai', 'gemini'] });
  });
});
